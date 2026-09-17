import { getAgentStatus, listRecentSessions } from "@/lib/agent/engine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getAgentStatus();
    const recentSessions = await listRecentSessions(8);

    return Response.json({
      ok: true,
      status,
      recentSessions,
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
