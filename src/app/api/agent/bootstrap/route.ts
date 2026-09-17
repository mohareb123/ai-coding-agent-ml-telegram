import { db } from "@/db";
import { promptDocuments } from "@/db/schema";
import { rebuildTrainingSamples, trainModel } from "@/lib/agent/engine";
import { fetchSystemPromptDocuments } from "@/lib/agent/repo";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

function approximateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

export async function POST() {
  try {
    const docs = await fetchSystemPromptDocuments(200);

    for (const doc of docs) {
      await db
        .insert(promptDocuments)
        .values({
          sourcePath: doc.sourcePath,
          content: doc.content,
          tokenCount: approximateTokens(doc.content),
        })
        .onConflictDoUpdate({
          target: promptDocuments.sourcePath,
          set: {
            content: doc.content,
            tokenCount: approximateTokens(doc.content),
            updatedAt: sql`now()`,
          },
        });
    }

    const sampleStats = await rebuildTrainingSamples();
    const trainingStats = await trainModel();

    return Response.json({
      ok: true,
      importedDocs: docs.length,
      sampleStats,
      trainingStats,
    });
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
