import { getTelegramMe, setTelegramWebhook } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const origin = process.env.APP_URL || new URL(request.url).origin;
    const webhookUrl = `${origin}/api/telegram/webhook`;

    const me = await getTelegramMe();
    const setup = await setTelegramWebhook(webhookUrl);

    return Response.json({
      ok: true,
      bot: me.result,
      webhookUrl,
      telegram: setup,
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
