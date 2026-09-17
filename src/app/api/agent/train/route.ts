import { rebuildTrainingSamples, trainModel } from "@/lib/agent/engine";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const sampleStats = await rebuildTrainingSamples();
    const trainingStats = await trainModel();

    return Response.json({
      ok: true,
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
