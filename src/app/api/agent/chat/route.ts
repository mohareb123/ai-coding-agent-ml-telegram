import { answerCodingQuestion } from "@/lib/agent/engine";

export const dynamic = "force-dynamic";

type Body = {
  message?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const message = body.message?.trim();

    if (!message) {
      return Response.json({ ok: false, error: "الرسالة مطلوبة." }, { status: 400 });
    }

    const result = await answerCodingQuestion(message);

    return Response.json({
      ok: true,
      ...result,
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
