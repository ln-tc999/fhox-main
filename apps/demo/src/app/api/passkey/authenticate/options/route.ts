import { NextResponse, type NextRequest } from "next/server";
import { Authentication } from "webauthx/server";
import { CHALLENGE_COOKIE, rpIdFor } from "../../_shared";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    credentialIds?: string[];
  };

  const { challenge, options } = Authentication.getOptions({
    rpId: rpIdFor(req),
    credentialId: body.credentialIds && body.credentialIds.length > 0 ? body.credentialIds : undefined,
    userVerification: "preferred",
  });

  const res = NextResponse.json(options);
  res.cookies.set(CHALLENGE_COOKIE, challenge, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 300,
  });
  return res;
}
