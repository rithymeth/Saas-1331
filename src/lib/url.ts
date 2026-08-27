import { headers } from "next/headers";

/**
 * The request's Host header is attacker-controllable (a client can send any
 * value directly to the origin unless a trusted proxy normalizes it), so it
 * must never be used to build links that carry secrets (password resets,
 * email verification, invites) in production — doing so lets an attacker
 * redirect those links to a domain they control. Only trust it in
 * development, where the request is coming from the developer's own machine.
 */
export async function resolveAppUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_APP_URL must be set in production. Refusing to build a URL from the request's Host header, which is attacker-controllable."
    );
  }

  const host = (await headers()).get("host");
  return `http://${host}`;
}
