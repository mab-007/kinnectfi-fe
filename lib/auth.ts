// Auth header for API calls — now backed by the real Privy session token
// (replaces the old dev "fake:<id>" shim). The token comes from Privy via the
// bridge in lib/privy.ts, set once the SDK is ready.
import { getPrivyAccessToken } from "./privy";

export async function authHeader(): Promise<string> {
  return `Bearer ${await getPrivyAccessToken()}`;
}
