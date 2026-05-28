import { NextResponse, type NextRequest } from "next/server";
import { Registration } from "webauthx/server";
import { CHALLENGE_COOKIE, originFor, rpIdFor } from "../../_shared";

export async function POST(req: NextRequest) {
  const challenge = req.cookies.get(CHALLENGE_COOKIE)?.value;
  if (!challenge) {
    return NextResponse.json({ error: "Missing challenge cookie." }, { status: 400 });
  }
  const credential = await req.json();

  try {
    const result = Registration.verify(credential, {
      challenge: challenge as `0x${string}`,
      origin: originFor(req),
      rpId: rpIdFor(req),
    });

    const res = NextResponse.json({
      id: result.id,
      publicKey: result.publicKey,
      aaguid: result.aaguid ?? null,
    });
    res.cookies.delete(CHALLENGE_COOKIE);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
