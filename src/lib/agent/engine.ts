import { db } from "@/db";
import { agentSessions, neuralModels, promptDocuments, trainingSamples } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import KNN from "ml-knn";
import { CODING_LABELS, buildVocabulary, inferLabel, normalizeText, splitToSamples, vectorize } from "./text";

type RankedLabel = { label: string; score: number };

type StoredModelJson = {
  knn: Record<string, unknown>;
  centroids: Record<string, number[]>;
  k: number;
};

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  const size = Math.min(a.length, b.length);
  for (let i = 0; i < size; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function softmax(values: number[]): number[] {
  const maxVal = Math.max(...values);
  const exps = values.map((v) => Math.exp(v - maxVal));
  const sum = exps.reduce((acc, v) => acc + v, 0) || 1;
  return exps.map((v) => v / sum);
}

function computeCentroids(vectors: number[][], labels: string[]) {
  const sums: Record<string, number[]> = {};
  const counts: Record<string, number> = {};

  for (let i = 0; i < vectors.length; i += 1) {
    const label = labels[i];
    const vector = vectors[i];

    if (!sums[label]) {
      sums[label] = new Array(vector.length).fill(0);
      counts[label] = 0;
    }

    for (let j = 0; j < vector.length; j += 1) {
      sums[label][j] += vector[j];
    }
    counts[label] += 1;
  }

  const centroids: Record<string, number[]> = {};
  for (const [label, sumVector] of Object.entries(sums)) {
    const count = counts[label] || 1;
    centroids[label] = sumVector.map((v) => v / count);
  }

  return centroids;
}

function rankByCentroidSimilarity(input: number[], centroids: Record<string, number[]>, labels: string[]): RankedLabel[] {
  const rawScores = labels.map((label) => {
    const centroid = centroids[label];
    const sim = centroid ? cosineSimilarity(input, centroid) : 0;
    return sim;
  });

  const probs = softmax(rawScores);
  return labels
    .map((label, idx) => ({ label, score: probs[idx] ?? 0 }))
    .sort((a, b) => b.score - a.score);
}

function evaluateAccuracy(knn: KNN, x: number[][], y: number[]): number {
  if (!x.length) return 0;
  const preds = knn.predict(x) as number[];
  let correct = 0;

  for (let i = 0; i < preds.length; i += 1) {
    if (preds[i] === y[i]) correct += 1;
  }

  return correct / preds.length;
}

export async function rebuildTrainingSamples() {
  const docs = await db.select().from(promptDocuments);
  await db.delete(trainingSamples);

  let inserted = 0;
  for (const doc of docs) {
    const samples = splitToSamples(doc.content);
    for (const sample of samples) {
      await db.insert(trainingSamples).values({
        sourcePath: doc.sourcePath,
        sampleText: sample,
        label: inferLabel(sample),
      });
      inserted += 1;
    }
  }

  return { docs: docs.length, samples: inserted };
}

export async function trainModel() {
  const samples = await db.select().from(trainingSamples);
  if (!samples.length) throw new Error("لا توجد بيانات تدريب. نفّذ الاستيراد أولًا.");

  const shuffled = shuffleArray(samples);
  const splitIdx = Math.max(1, Math.floor(shuffled.length * 0.8));
  const trainRows = shuffled.slice(0, splitIdx);
  const validationRows = shuffled.slice(splitIdx);

  const labels = [...CODING_LABELS];
  const vocabulary = buildVocabulary(trainRows.map((s) => s.sampleText));

  const toLabelIndex = (label: string) => {
    const idx = labels.indexOf(label as (typeof labels)[number]);
    return idx >= 0 ? idx : labels.length - 1;
  };

  const trainX = trainRows.map((row) => vectorize(row.sampleText, vocabulary));
  const trainY = trainRows.map((row) => toLabelIndex(row.label));

  const valX = validationRows.map((row) => vectorize(row.sampleText, vocabulary));
  const valY = validationRows.map((row) => toLabelIndex(row.label));

  const k = Math.min(7, Math.max(3, Math.round(Math.sqrt(trainX.length))));
  const knn = new KNN(trainX, trainY, { k });

  const trainAccuracy = evaluateAccuracy(knn, trainX, trainY);
  const validationAccuracy = valX.length ? evaluateAccuracy(knn, valX, valY) : trainAccuracy;

  const trainLabelNames = trainY.map((idx) => labels[idx]);
  const centroids = computeCentroids(trainX, trainLabelNames);

  const modelJson: StoredModelJson = {
    knn: knn.toJSON() as Record<string, unknown>,
    centroids,
    k,
  };

  await db.insert(neuralModels).values({
    modelName: "coding-agent-v3",
    modelType: "ml-knn",
    labels,
    vocabulary,
    modelJson,
    trainingLoss: (1 - validationAccuracy).toFixed(6),
    trainingAccuracy: trainAccuracy,
    validationAccuracy,
    epochs: 1,
  });

  return {
    samples: samples.length,
    trainingSamples: trainX.length,
    validationSamples: valX.length,
    vocabSize: Object.keys(vocabulary).length,
    labels: labels.length,
    k,
    trainAccuracy,
    validationAccuracy,
  };
}

export async function getLatestModel() {
  const latest = await db.select().from(neuralModels).orderBy(desc(neuralModels.createdAt)).limit(1);
  return latest[0] ?? null;
}

async function retrieveRelevantSamples(message: string, vocabulary: Record<string, number>, labelHint?: string) {
  const rows = labelHint
    ? await db.select().from(trainingSamples).where(eq(trainingSamples.label, labelHint)).limit(150)
    : await db.select().from(trainingSamples).limit(150);

  const inputVector = vectorize(message, vocabulary);

  return rows
    .map((sample) => {
      const sim = cosineSimilarity(inputVector, vectorize(sample.sampleText, vocabulary));
      return { sample, sim };
    })
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 6)
    .map((x) => x.sample);
}

function buildAnswer(message: string, ranked: RankedLabel[], hints: string[]) {
  const confidencePct = ((ranked[0]?.score ?? 0) * 100).toFixed(1);
  const topThree = ranked
    .slice(0, 3)
    .map((r) => `${r.label}: ${(r.score * 100).toFixed(1)}%`)
    .join(" | ");

  return [
    `سؤالك: ${message}`,
    `تحليل النية: المجال الأقرب **${ranked[0]?.label ?? "architecture"}** (ثقة ${confidencePct}%).`,
    `توزيع التصنيفات: ${topThree}`,
    "",
    "خطة تنفيذ احترافية:",
    "1) حلّل المتطلبات ثم حوّلها إلى مهام صغيرة قابلة للتنفيذ.",
    "2) صمّم schema + API contract قبل البدء في الواجهة.",
    "3) اكتب منطق الخدمات بشكل منفصل ليسهل الاختبار والصيانة.",
    "4) أضف التحقق الأمني للمدخلات وتعامل واضح مع الأخطاء.",
    "5) نفّذ typegen + tsc + build قبل أي إطلاق.",
    "",
    "تعليمات مشابهة من بيانات system prompts:",
    ...hints.map((h) => `- ${h}`),
  ].join("\n");
}

export async function answerCodingQuestion(message: string, channel: "web" | "telegram" = "web") {
  const cleanMessage = normalizeText(message);
  const model = await getLatestModel();
  if (!model) throw new Error("النموذج غير مدرّب. نفّذ التدريب أولًا.");

  const labels = (model.labels as string[]) ?? [];
  const vocabulary = (model.vocabulary as Record<string, number>) ?? {};
  const modelJson = (model.modelJson as StoredModelJson) ?? { knn: {}, centroids: {}, k: 3 };

  const input = vectorize(cleanMessage, vocabulary);

  const knn = KNN.load(modelJson.knn as object);
  const predictedIndex = (knn.predict([input]) as number[])[0] ?? labels.length - 1;
  const predictedLabel = labels[predictedIndex] ?? "architecture";

  const ranked = rankByCentroidSimilarity(input, modelJson.centroids ?? {}, labels);
  if (!ranked.find((r) => r.label === predictedLabel)) {
    ranked.unshift({ label: predictedLabel, score: 1 });
  }

  const relatedSamples = await retrieveRelevantSamples(cleanMessage, vocabulary, predictedLabel);
  const hints = relatedSamples.map((s) => s.sampleText).slice(0, 5);
  const answer = buildAnswer(message, ranked, hints);

  const references = relatedSamples.map((s) => ({ sourcePath: s.sourcePath, sample: s.sampleText }));

  await db.insert(agentSessions).values({
    message,
    answer,
    predictedLabel,
    confidence: ranked[0]?.score ?? 0,
    topScores: ranked,
    references,
    channel,
  });

  return {
    labelScores: ranked,
    answer,
    references,
  };
}

export async function getAgentStatus() {
  const [docsCount] = await db.select({ total: sql<number>`count(*)::int` }).from(promptDocuments);
  const [samplesCount] = await db.select({ total: sql<number>`count(*)::int` }).from(trainingSamples);
  const [sessionsCount] = await db.select({ total: sql<number>`count(*)::int` }).from(agentSessions);
  const latestModel = await getLatestModel();

  return {
    documents: docsCount?.total ?? 0,
    trainingSamples: samplesCount?.total ?? 0,
    sessions: sessionsCount?.total ?? 0,
    latestModel: latestModel
      ? {
          name: latestModel.modelName,
          type: latestModel.modelType,
          loss: latestModel.trainingLoss,
          epochs: latestModel.epochs,
          trainingAccuracy: latestModel.trainingAccuracy,
          validationAccuracy: latestModel.validationAccuracy,
          createdAt: latestModel.createdAt,
        }
      : null,
  };
}

export async function listRecentSessions(limit = 10) {
  return db.select().from(agentSessions).orderBy(desc(agentSessions.createdAt)).limit(limit);
}
