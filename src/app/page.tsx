import { AgentConsole } from "@/components/agent-console";
import { db } from "@/db";
import { neuralModels, promptDocuments, trainingSamples } from "@/db/schema";
import { count, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [docsCountRow] = await db.select({ total: count() }).from(promptDocuments);
  const [samplesCountRow] = await db.select({ total: count() }).from(trainingSamples);
  const latestModel = await db.select().from(neuralModels).orderBy(desc(neuralModels.createdAt)).limit(1);

  const model = latestModel[0];

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-10 md:px-8">
      <section className="glass-card mb-6 rounded-3xl border border-white/80 p-6 shadow-2xl shadow-indigo-100">
        <p className="text-xs uppercase tracking-[0.12em] text-indigo-700">AI Coding Agent Studio</p>
        <h1 className="mt-2 text-3xl font-black text-slate-900">وكيل برمجي ذكي — ML + Telegram</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-700">
          منصة متكاملة تقوم باستيراد system prompts من GitHub، تدريب نموذج تصنيف باستخدام مكتبة تعلم آلي،
          وتشغيل وكيل برمجي عبر الويب أو Telegram Bot مع تتبّع المستخدمين والجلسات.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-5">
          <InfoCard label="Docs" value={docsCountRow?.total ?? 0} />
          <InfoCard label="Samples" value={samplesCountRow?.total ?? 0} />
          <InfoCard label="Model" value={model?.modelType ?? "N/A"} />
          <InfoCard
            label="Train Acc"
            value={model ? `${((model.trainingAccuracy ?? 0) * 100).toFixed(1)}%` : "N/A"}
          />
          <InfoCard
            label="Val Acc"
            value={model ? `${((model.validationAccuracy ?? 0) * 100).toFixed(1)}%` : "N/A"}
          />
        </div>
      </section>

      <AgentConsole />
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
    </article>
  );
}
