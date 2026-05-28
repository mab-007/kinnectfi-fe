// DEV auth shim. Real Privy (auth + embedded wallet) lands later; until then the
// BE runs its FakeAuthAdapter, which accepts a bearer of the form
// "fake:<externalUserId>" and treats OTP "000000" as valid.
//
// We persist a stable externalUserId + a dummy wallet address per install so
// re-running signup is idempotent (BE keys the user on auth_external_id, and the
// wallet table is unique on (chain, address)).
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const KEY_EXTERNAL_ID = "kinnectfi.dev.externalUserId";
const KEY_WALLET = "kinnectfi.dev.walletAddress";

// SecureStore is native-only; fall back to localStorage on web for smoke testing.
const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === "web") return globalThis.localStorage?.getItem(key) ?? null;
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") {
      globalThis.localStorage?.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
};

function randomHex(bytes: number): string {
  let out = "";
  for (let i = 0; i < bytes * 2; i++) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out;
}

export async function getExternalUserId(): Promise<string> {
  let id = await storage.get(KEY_EXTERNAL_ID);
  if (!id) {
    id = `privy-dev-${randomHex(6)}`;
    await storage.set(KEY_EXTERNAL_ID, id);
  }
  return id;
}

export async function getDevWalletAddress(): Promise<string> {
  let addr = await storage.get(KEY_WALLET);
  if (!addr) {
    addr = `0x${randomHex(20)}`;
    await storage.set(KEY_WALLET, addr);
  }
  return addr;
}

export async function authHeader(): Promise<string> {
  return `Bearer fake:${await getExternalUserId()}`;
}
