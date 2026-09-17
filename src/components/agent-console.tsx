"use client";

import { useEffect, useState } from "react";

type AgentStatus = {
  documents: number;
  trainingSamples: number;
  sessions: number;
  latestModel: {
    name: string;
    type?: string;
    loss: string;
    epochs: number;
    trainingAccuracy: number;
    validationAccuracy: number;
    createdAt: string;
  } | null;
};

type TelegramStatus = {
  bot: { id: number; username?: string; first_name?: string } | null;
  users: number;
  messages: number;
  webhookPath: string;
};

type TelegramLinkedUser = {
  id: number;
  telegramId: string;
  username: string | null;
  firstName: string | null;
};

type ApiResult = {
  ok: boolean;
  error?: string;
  answer?: string;
  status?: AgentStatus;
  recentSessions?: Array<{
    id: number;
    message: string;
    predictedLabel: string;
    confidence: number;
    createdAt: string;
    channel: string;
  }>;
  user?: TelegramLinkedUser;
  bot?: TelegramStatus["bot"];
  users?: number;
  messages?: number;
  [key: string]: unknown;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
      };
    };
  }
}

export function AgentConsole() {
  const [message, setMessage] = useState("ابني لي API آمن باستخدام Next.js وDrizzle");
  const [busy, setBusy] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [answer, setAnswer] = useState<string>("");
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(null);
  const [linkedTelegramUser, setLinkedTelegramUser] = useState<TelegramLinkedUser | null>(null);
  const [recentSessions, setRecentSessions] = useState<NonNullable<ApiResult["recentSessions"]>>([]);
  const [canLinkTelegram, setCanLinkTelegram] = useState(false);

  async function callApi(endpoint: string, method: "GET" | "POST" = "POST", payload?: unknown) {
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: payload ? JSON.stringify(payload) : undefined,
    });

    return (await response.json()) as ApiResult;
  }

  function appendLog(label: string, result: ApiResult) {
    setLogs((prev) => [`${label}: ${JSON.stringify(result)}`, ...prev].slice(0, 12));
  }

  async function refreshAgentStatus() {
    setBusy("status");
    const result = await callApi("/api/agent/status", "GET");
    if (result.ok) {
      setStatus(result.status ?? null);
      setRecentSessions(result.recentSessions ?? []);
    }
    appendLog("AgentStatus", result);
    setBusy(null);
  }

  async function refreshTelegramStatus() {
    setBusy("telegram-status");
    const result = await callApi("/api/telegram/status", "GET");
    if (result.ok) {
      setTelegramStatus({
        bot: (result.bot as TelegramStatus["bot"]) ?? null,
        users: Number(result.users ?? 0),
        messages: Number(result.messages ?? 0),
        webhookPath: String(result.webhookPath ?? "/api/telegram/webhook"),
      });
    }
    appendLog("TelegramStatus", result);
    setBusy(null);
  }

  async function bootstrap() {
    setBusy("bootstrap");
    const result = await callApi("/api/agent/bootstrap");
    appendLog("Bootstrap", result);
    await refreshAgentStatus();
    setBusy(null);
  }

  async function ingest() {
    setBusy("ingest");
    const result = await callApi("/api/agent/ingest");
    appendLog("Ingest", result);
    await refreshAgentStatus();
    setBusy(null);
  }

  async function train() {
    setBusy("train");
    const result = await callApi("/api/agent/train");
    appendLog("Train", result);
    await refreshAgentStatus();
    setBusy(null);
  }

  async function chat() {
    setBusy("chat");
    const result = await callApi("/api/agent/chat", "POST", { message });

    if (result.ok && typeof result.answer === "string") {
      setAnswer(result.answer);
    }

    appendLog("Chat", result);
    await refreshAgentStatus();
    setBusy(null);
  }

  async function setupTelegramWebhook() {
    setBusy("telegram-setup");
    const result = await callApi("/api/telegram/setup", "POST");
    appendLog("TelegramSetup", result);
    await refreshTelegramStatus();
    setBusy(null);
  }

  async function linkTelegramUser() {
    setBusy("telegram-link");
    const initData = window?.Telegram?.WebApp?.initData;
    if (!initData) {
      appendLog("TelegramLink", { ok: false, error: "Telegram WebApp initData غير متوفر" });
      setBusy(null);
      return;
    }

    const result = await callApi("/api/telegram/link", "POST", { initData });
    if (result.ok && result.user) {
      setLinkedTelegramUser(result.user as TelegramLinkedUser);
    }
    appendLog("TelegramLink", result);
    await refreshTelegramStatus();
    setBusy(null);
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCanLinkTelegram(Boolean(window.Telegram?.WebApp?.initData));
    }

    refreshAgentStatus();
    refreshTelegramStatus();
  }, []);

  return (
    <section className="grid gap-6">
      <div className="glass-card rounded-3xl border border-white/70 p-6 shadow-xl shadow-indigo-100">
        <h2 className="text-xl font-bold text-slate-900">لوحة الوكيل البرمجي (ML + Telegram)</h2>
        <p className="mt-2 text-sm text-slate-600">
          الآن التدريب يعتمد على مكتبة ML فعلية (KNN) مع حفظ النموذج، بالإضافة لتكامل Telegram Bot وTelegram User.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <button className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" onClick={bootstrap} disabled={busy !== null}>
            {busy === "bootstrap" ? "جاري التهيئة..." : "Bootstrap كامل"}
          </button>
          <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" onClick={ingest} disabled={busy !== null}>
            {busy === "ingest" ? "..." : "استيراد"}
          </button>
          <button className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" onClick={train} disabled={busy !== null}>
            {busy === "train" ? "..." : "تدريب ML"}
          </button>
          <button className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-800 disabled:opacity-60" onClick={refreshAgentStatus} disabled={busy !== null}>
            تحديث حالة الوكيل
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <StatCard label="Docs" value={status?.documents ?? 0} />
          <StatCard label="Samples" value={status?.trainingSamples ?? 0} />
          <StatCard label="Sessions" value={status?.sessions ?? 0} />
          <StatCard
            label="Val Acc"
            value={status?.latestModel ? `${(status.latestModel.validationAccuracy * 100).toFixed(1)}%` : "N/A"}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <article className="glass-card rounded-3xl border border-white/70 p-5 shadow-lg lg:col-span-2">
          <h3 className="text-base font-semibold text-slate-900">المحادثة</h3>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="mt-3 min-h-28 w-full rounded-2xl border border-slate-300 bg-white p-3 text-sm outline-none ring-indigo-500 focus:ring"
          />
          <button className="mt-3 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" onClick={chat} disabled={busy !== null}>
            {busy === "chat" ? "جاري التحليل..." : "اسأل الوكيل"}
          </button>

          <pre className="mt-4 whitespace-pre-wrap rounded-2xl bg-slate-900 p-4 text-xs leading-6 text-slate-100">
            {answer || "النتيجة ستظهر هنا..."}
          </pre>
        </article>

        <article className="glass-card rounded-3xl border border-white/70 p-5 shadow-lg">
          <h3 className="text-base font-semibold text-slate-900">جلسات حديثة</h3>
          <ul className="mt-3 space-y-2 text-xs">
            {recentSessions.length === 0 ? <li className="text-slate-500">لا توجد جلسات بعد.</li> : null}
            {recentSessions.map((s) => (
              <li key={s.id} className="rounded-xl border border-slate-200 bg-white p-2">
                <p className="font-semibold text-slate-800">{s.predictedLabel}</p>
                <p className="line-clamp-2 text-slate-600">{s.message}</p>
                <p className="text-slate-500">{(s.confidence * 100).toFixed(1)}% · {s.channel}</p>
              </li>
            ))}
          </ul>
        </article>
      </div>

      <div className="glass-card rounded-3xl border border-white/70 p-6 shadow-xl shadow-sky-100">
        <h3 className="text-lg font-bold text-slate-900">تكامل Telegram Bot + Telegram User</h3>
        <p className="mt-1 text-sm text-slate-600">
          يتطلب متغيرات البيئة: TELEGRAM_BOT_TOKEN و TELEGRAM_WEBHOOK_SECRET (اختياري) و APP_URL.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <button className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" onClick={setupTelegramWebhook} disabled={busy !== null}>
            إعداد Webhook للبوت
          </button>
          <button className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-800 disabled:opacity-60" onClick={refreshTelegramStatus} disabled={busy !== null}>
            تحديث Telegram
          </button>
          <button className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" onClick={linkTelegramUser} disabled={busy !== null || !canLinkTelegram}>
            ربط Telegram User (WebApp)
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <StatCard label="Bot" value={telegramStatus?.bot?.username ?? "غير متصل"} />
          <StatCard label="Telegram Users" value={telegramStatus?.users ?? 0} />
          <StatCard label="Telegram Msgs" value={telegramStatus?.messages ?? 0} />
          <StatCard label="Webhook" value={telegramStatus?.webhookPath ?? "N/A"} />
        </div>

        {linkedTelegramUser ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            تم ربط المستخدم: @{linkedTelegramUser.username ?? "unknown"} (ID: {linkedTelegramUser.telegramId})
          </div>
        ) : null}
      </div>

      <article className="glass-card rounded-3xl border border-white/70 p-5 shadow-lg">
        <h3 className="text-base font-semibold text-slate-900">سجل العمليات</h3>
        <ul className="mt-3 space-y-2 text-xs text-slate-700">
          {logs.length === 0 ? <li>لا يوجد سجل بعد.</li> : null}
          {logs.map((log) => (
            <li key={log} className="break-all rounded-xl border border-slate-200 bg-white p-2">
              {log}
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
