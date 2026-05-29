// Authorization header for API calls. Normally backed by the real Privy session
// token; in fake mode (EXPO_PUBLIC_AUTH_MODE=fake) it emits the dev bearer
// `fake:<externalUserId>` that the BE FakeAuthAdapter accepts — no Privy round
// trip, so testers can sign in with a dummy email + OTP `000000`.
import { getDevSessionId, isFakeAuth } from "./session";
import { getPrivyAccessToken } from "./privy";

export async function authHeader(): Promise<string> {
  if (isFakeAuth) {
    const id = getDevSessionId();
    if (!id) throw new Error("Not authenticated");
    return `Bearer fake:${id}`;
  }
  return `Bearer ${await getPrivyAccessToken()}`;
}
