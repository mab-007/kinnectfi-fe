// Bridges Privy's React-hook access-token getter to the plain (non-React) API
// client. `_layout.tsx` registers `usePrivy().getAccessToken` once Privy is
// ready; `lib/auth.ts` reads it for the Authorization header.
type TokenGetter = () => Promise<string | null>;

let getter: TokenGetter | null = null;

export function registerTokenGetter(fn: TokenGetter): void {
  getter = fn;
}

export async function getPrivyAccessToken(): Promise<string> {
  if (!getter) throw new Error("Privy is not ready yet");
  const token = await getter();
  if (!token) throw new Error("Not authenticated");
  return token;
}
