import { NextResponse, type NextRequest } from "next/server";
import { Authentication } from "webauthx/server";
import { CHALLENGE_COOKIE, originFor, rpIdFor } from "../../_shared";

export async function POST(req: NextRequest) {
  const challenge = req.cookies.get(CHALLENGE_COOKIE)?.value;
  if (!challenge) {
    return NextResponse.json({ error: "Missing challenge cookie." }, { status: 400 });
  }

  const { response, publicKey } = (await req.json()) as {
    response: Parameters<typeof Authentication.verify>[0];
    publicKey: `0x${string}`;
  };

  try {
    const valid = Authentication.verify(response, {
      challenge: challenge as `0x${string}`,
      publicKey,
      origin: originFor(req),
      rpId: rpIdFor(req),
    });

    if (!valid) {
      return NextResponse.json({ error: "Invalid passkey signature." }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.delete(CHALLENGE_COOKIE);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
