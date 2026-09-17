import { db } from "@/db";
import { telegramMessages, telegramUsers } from "@/db/schema";
import { answerCodingQuestion } from "@/lib/agent/engine";
import { sendTelegramMessage, verifyTelegramWebhookSecret, type TelegramMessageUpdate } from "@/lib/telegram";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const secretHeader = request.headers.get("x-telegram-bot-api-secret-token");
    if (!verifyTelegramWebhookSecret(secretHeader)) {
      return Response.json({ ok: false, error: "Unauthorized webhook" }, { status: 401 });
    }

    const update = (await request.json()) as TelegramMessageUpdate;
    const text = update.message?.text?.trim();
    const chatId = update.message?.chat?.id;
    const from = update.message?.from;

    if (!chatId || !text || !from) {
      return Response.json({ ok: true, skipped: true });
    }

    await db
      .insert(telegramUsers)
      .values({
        telegramId: String(from.id),
        chatId: String(chatId),
        username: from.username,
        firstName: from.first_name,
        lastName: from.last_name,
        languageCode: from.language_code,
        isBot: Boolean(from.is_bot),
        isPremium: Boolean(from.is_premium),
      })
      .onConflictDoUpdate({
        target: telegramUsers.telegramId,
        set: {
          chatId: String(chatId),
          username: from.username,
          firstName: from.first_name,
          lastName: from.last_name,
          languageCode: from.language_code,
          isBot: Boolean(from.is_bot),
          isPremium: Boolean(from.is_premium),
          updatedAt: sql`now()`,
        },
      });

    const [user] = await db.select().from(telegramUsers).where(eq(telegramUsers.telegramId, String(from.id))).limit(1);

    await db.insert(telegramMessages).values({
      telegramUserId: user?.id,
      chatId: String(chatId),
      direction: "incoming",
      text,
      rawUpdate: update as unknown as Record<string, unknown>,
    });

    let reply = "استخدم /start للبدء.";

    if (text === "/start") {
      reply =
        "أهلًا بك في Coding Agent Bot 👋\n" +
        "أرسل سؤالك البرمجي مباشرة وسأرد بخطة تنفيذ عملية.\n" +
        "يفضل أولًا تدريب النموذج من واجهة الويب.";
    } else {
      try {
        const result = await answerCodingQuestion(text, "telegram");
        reply = result.answer.slice(0, 3500);
      } catch (error) {
        reply = `تعذر التحليل الآن: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    }

    await sendTelegramMessage(chatId, reply);

    await db.insert(telegramMessages).values({
      telegramUserId: user?.id,
      chatId: String(chatId),
      direction: "outgoing",
      text: reply,
      rawUpdate: update as unknown as Record<string, unknown>,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
