import crypto from "node:crypto";

export type TelegramUser = {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
};

export type TelegramMessageUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number | string; type: string };
    from?: TelegramUser;
  };
};

function getBotToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is required");
  }
  return token;
}

function getApiBase() {
  return `https://api.telegram.org/bot${getBotToken()}`;
}

export async function telegramApi<T>(method: string, payload: Record<string, unknown>) {
  const response = await fetch(`${getApiBase()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Telegram API ${method} failed: ${response.status}`);
  }

  return (await response.json()) as { ok: boolean; result: T; description?: string };
}

export async function sendTelegramMessage(chatId: string | number, text: string) {
  return telegramApi("sendMessage", {
    chat_id: chatId,
    text,
  });
}

export async function getTelegramMe() {
  return telegramApi<{ id: number; username?: string; first_name?: string }>("getMe", {});
}

export async function setTelegramWebhook(url: string) {
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;

  return telegramApi<boolean>("setWebhook", {
    url,
    drop_pending_updates: true,
    secret_token: secretToken,
    allowed_updates: ["message"],
  });
}

export function verifyTelegramWebhookSecret(received: string | null) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return true;
  return received === expected;
}

export type InitDataVerification = { ok: true; user: TelegramUser } | { ok: false; reason: string };

export function verifyTelegramInitData(initData: string): InitDataVerification {
  const token = getBotToken();
  const params = new URLSearchParams(initData);

  const hash = params.get("hash");
  if (!hash) return { ok: false, reason: "Missing hash" };

  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  const generatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (generatedHash !== hash) {
    return { ok: false, reason: "Invalid hash" };
  }

  const userRaw = params.get("user");
  if (!userRaw) {
    return { ok: false, reason: "Missing user payload" };
  }

  let user: TelegramUser;
  try {
    user = JSON.parse(userRaw) as TelegramUser;
  } catch {
    return { ok: false, reason: "Invalid user payload" };
  }

  return { ok: true, user };
}
