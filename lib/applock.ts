// App-lock: once a user has turned on device biometrics during onboarding, a
// cold launch must re-authenticate (Face ID / Touch ID, with device-passcode
// fallback) before the app is shown. Designed to FAIL OPEN — if the lock can't
// be enforced (no hardware, not enrolled, read error) the user is let through,
// so this can never strand someone out of their account.
import * as SecureStore from "expo-secure-store";

const KEY = "kinnectfi.appLockEnabled";

let enabled: boolean | null = null; // null = not loaded yet
let unlockedThisLaunch = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function subscribeAppLock(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// Snapshot string for useSyncExternalStore — changes whenever lock state changes.
export function appLockSnapshot(): string {
  return `${enabled}:${unlockedThisLaunch}`;
}

export async function loadAppLock(): Promise<void> {
  try {
    enabled = (await SecureStore.getItemAsync(KEY)) === "1";
  } catch {
    enabled = false;
  }
  emit();
}

export const isAppLockReady = (): boolean => enabled !== null;
export const isAppLockEnabled = (): boolean => enabled === true;
export const isUnlocked = (): boolean => unlockedThisLaunch;

export async function setAppLockEnabled(on: boolean): Promise<void> {
  enabled = on;
  try {
    if (on) await SecureStore.setItemAsync(KEY, "1");
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    // best-effort; in-memory value still drives this launch
  }
  emit();
}

export function markUnlocked(): void {
  unlockedThisLaunch = true;
  emit();
}

export function relock(): void {
  unlockedThisLaunch = false;
  emit();
}
