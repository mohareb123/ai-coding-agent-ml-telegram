import { db } from "@/db";
import { promptDocuments } from "@/db/schema";
import { fetchSystemPromptDocuments } from "@/lib/agent/repo";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

function approximateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

export async function POST() {
  try {
    const docs = await fetchSystemPromptDocuments(160);

    let saved = 0;

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

      saved += 1;
    }

    return Response.json({
      ok: true,
      imported: docs.length,
      saved,
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
