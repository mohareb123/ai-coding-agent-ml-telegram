import { db } from "@/db";
import { telegramUsers } from "@/db/schema";
import { verifyTelegramInitData } from "@/lib/telegram";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Body = {
  initData?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const initData = body.initData?.trim();

    if (!initData) {
      return Response.json({ ok: false, error: "initData is required" }, { status: 400 });
    }

    const verification = verifyTelegramInitData(initData);
    if (!verification.ok) {
      return Response.json({ ok: false, error: verification.reason }, { status: 401 });
    }

    const user = verification.user;

    await db
      .insert(telegramUsers)
      .values({
        telegramId: String(user.id),
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        languageCode: user.language_code,
        isBot: Boolean(user.is_bot),
        isPremium: Boolean(user.is_premium),
      })
      .onConflictDoUpdate({
        target: telegramUsers.telegramId,
        set: {
          username: user.username,
          firstName: user.first_name,
          lastName: user.last_name,
          languageCode: user.language_code,
          isBot: Boolean(user.is_bot),
          isPremium: Boolean(user.is_premium),
          updatedAt: sql`now()`,
        },
      });

    const [saved] = await db.select().from(telegramUsers).where(eq(telegramUsers.telegramId, String(user.id))).limit(1);

    return Response.json({
      ok: true,
      user: saved,
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
