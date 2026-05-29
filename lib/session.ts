// Auth-mode seam for the app. In production/normal dev the session is owned by
// Privy (`@privy-io/expo`). When EXPO_PUBLIC_AUTH_MODE=fake the app bypasses
// Privy entirely and runs a local "dev session" so testers can sign in with a
// dummy email + the fixed OTP `000000` (BE: AUTH_MODE=fake, FakeAuthAdapter)
// without fetching a real SMS/email code on every run. The BE refuses
// AUTH_MODE=fake in production, so this lane can never reach prod.
import * as SecureStore from "expo-secure-store";
import { usePrivy } from "@privy-io/expo";
import { useSyncExternalStore } from "react";

export const AUTH_MODE = (process.env.EXPO_PUBLIC_AUTH_MODE ?? "privy") as "privy" | "fake";
export const isFakeAuth = AUTH_MODE === "fake";

// ── Dev session store (fake mode only) ───────────────────────
// The fake bearer token is `fake:<externalUserId>` (BE FakeAuthAdapter). We
// persist the id so an app reload resumes the same user — parity with Privy's
// session restore. Keying the id off the email (`dev-<email>`) makes re-entering
// the same email resume the same test user, and a new email = a fresh user.
const STORE_KEY = "kinnectfi.devSession.externalUserId";

let externalUserId: string | null = null;
let booted = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function devUserIdForEmail(email: string): string {
  return `dev-${email.trim().toLowerCase()}`;
}

export function getDevSessionId(): string | null {
  return externalUserId;
}

export async function bootDevSession(): Promise<void> {
  if (isFakeAuth) {
    try {
      externalUserId = await SecureStore.getItemAsync(STORE_KEY);
    } catch {
      externalUserId = null;
    }
  }
  booted = true;
  emit();
}

export async function setDevSession(id: string): Promise<void> {
  externalUserId = id;
  try {
    await SecureStore.setItemAsync(STORE_KEY, id);
  } catch {
    // best-effort persistence; the in-memory value still drives this run
  }
  emit();
}

async function clearDevSession(): Promise<void> {
  externalUserId = null;
  try {
    await SecureStore.deleteItemAsync(STORE_KEY);
  } catch {
    // ignore
  }
  emit();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function snapshot(): string {
  return `${booted}:${externalUserId ?? ""}`;
}

// ── Uniform session hook ─────────────────────────────────────
// Returns the same shape in both modes so screens never branch on the vendor.
// usePrivy() is always called (rules of hooks); its result is ignored in fake
// mode. Readiness in fake mode tracks the SecureStore restore, not Privy.
export interface Session {
  isReady: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
}

export function useSession(): Session {
  const privy = usePrivy();
  useSyncExternalStore(subscribe, snapshot, snapshot);

  if (isFakeAuth) {
    return {
      isReady: booted,
      isAuthenticated: Boolean(externalUserId),
      logout: clearDevSession,
    };
  }
  return {
    isReady: privy.isReady,
    isAuthenticated: Boolean(privy.user),
    logout: async () => {
      await privy.logout();
    },
  };
}
