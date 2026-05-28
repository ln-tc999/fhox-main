"use client";

import { Registration, Authentication } from "webauthx/client";

export function passkeysSupported(): boolean {
  if (typeof window === "undefined") return false;
  return !!window.PublicKeyCredential && !!navigator.credentials;
}

/** Full server-orchestrated registration ceremony. Returns the verified credential. */
export async function registerPasskey(args: {
  walletAddress: string;
  displayName: string;
}): Promise<{ id: `0x${string}`; publicKey: `0x${string}` }> {
  if (!passkeysSupported()) throw new Error("Passkeys are not supported on this device.");

  // 1. Ask the server for options + set a challenge cookie.
  const optionsRes = await fetch("/api/passkey/register/options", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: args.walletAddress, displayName: args.displayName }),
  });
  if (!optionsRes.ok) throw new Error("Failed to start passkey registration.");
  const options = await optionsRes.json();

  // 2. Prompt the user via WebAuthn.
  const credential = await Registration.create({ options });

  // 3. Server verifies the attestation and returns the stored credential.
  const verifyRes = await fetch("/api/passkey/register/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credential),
  });
  if (!verifyRes.ok) {
    const err = await verifyRes.json().catch(() => ({ error: "Verification failed." }));
    throw new Error(err.error ?? "Passkey verification failed.");
  }
  const stored = (await verifyRes.json()) as { id: `0x${string}`; publicKey: `0x${string}` };
  return stored;
}

/**
 * Authenticate against one of the supplied credential IDs.
 * The caller provides the publicKey associated with each credential so the
 * server can verify the signature statelessly.
 */
export async function authenticatePasskey(
  knownCredentials: { id: `0x${string}`; publicKey: `0x${string}` }[],
): Promise<{ id: `0x${string}` }> {
  if (!passkeysSupported()) throw new Error("Passkeys are not supported on this device.");
  if (knownCredentials.length === 0) throw new Error("No passkeys are registered.");

  // 1. Server issues challenge.
  const optionsRes = await fetch("/api/passkey/authenticate/options", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credentialIds: knownCredentials.map((c) => c.id) }),
  });
  if (!optionsRes.ok) throw new Error("Failed to start passkey sign-in.");
  const options = await optionsRes.json();

  // 2. User signs.
  const response = await Authentication.sign({ options });

  // 3. Locate the credential's stored pubkey by the id the user picked.
  const match = knownCredentials.find(
    (c) => c.id.toLowerCase() === (response.id as string).toLowerCase(),
  );
  if (!match) throw new Error("Passkey used does not match any stored credential.");

  // 4. Server verifies signature using the supplied pubkey.
  const verifyRes = await fetch("/api/passkey/authenticate/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ response, publicKey: match.publicKey }),
  });
  if (!verifyRes.ok) {
    const err = await verifyRes.json().catch(() => ({ error: "Verification failed." }));
    throw new Error(err.error ?? "Passkey verification failed.");
  }
  return { id: match.id };
}
