import { NextResponse, type NextRequest } from "next/server";
import { Registration } from "webauthx/server";
import { CHALLENGE_COOKIE, rpIdFor } from "../../_shared";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    displayName?: string;
  };
  const name = body.name ?? "corpus-agent";
  const displayName = body.displayName ?? name;
  const rpId = rpIdFor(req);

  const { challenge, options } = Registration.getOptions({
    user: { name, displayName },
    rp: { id: rpId, name: "CORPUS" },
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
    attestation: "none",
  });

  // Ensure both common algorithms are advertised so platform authenticators
  // (Touch ID, Windows Hello, hardware keys) all match. Webauthx defaults to
  // ES256 only; we add RS256 explicitly to silence the browser warning.
  options.publicKey.pubKeyCredParams = [
    { type: "public-key", alg: -7 },   // ES256
    { type: "public-key", alg: -257 }, // RS256
  ];

  const res = NextResponse.json(options);
  res.cookies.set(CHALLENGE_COOKIE, challenge, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 300,
  });
  return res;
}
