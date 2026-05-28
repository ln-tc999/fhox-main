import { type NextRequest, NextResponse } from "next/server";

const UPSTREAM = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const upstream = await fetch(UPSTREAM, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const data = await upstream.text();
  return new NextResponse(data, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
