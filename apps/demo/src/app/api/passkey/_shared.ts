import type { NextRequest } from "next/server";

export const CHALLENGE_COOKIE = "fhox.challenge";

export function rpIdFor(req: NextRequest): string {
  const host = req.headers.get("host") ?? "localhost";
  return host.split(":")[0];
}

export function originFor(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const host = req.headers.get("host") ?? "localhost";
  return `${proto}://${host}`;
}
