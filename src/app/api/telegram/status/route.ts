import { db } from "@/db";
import { telegramMessages, telegramUsers } from "@/db/schema";
import { getTelegramMe } from "@/lib/telegram";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [usersCount] = await db.select({ total: sql<number>`count(*)::int` }).from(telegramUsers);
    const [messagesCount] = await db.select({ total: sql<number>`count(*)::int` }).from(telegramMessages);

    let bot: { id: number; username?: string; first_name?: string } | null = null;
    try {
      const me = await getTelegramMe();
      bot = me.result;
    } catch {
      bot = null;
    }

    return Response.json({
      ok: true,
      bot,
      users: usersCount?.total ?? 0,
      messages: messagesCount?.total ?? 0,
      webhookPath: "/api/telegram/webhook",
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
