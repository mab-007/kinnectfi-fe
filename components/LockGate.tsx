import * as LocalAuthentication from "expo-local-authentication";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import {
  appLockSnapshot,
  isAppLockEnabled,
  isUnlocked,
  markUnlocked,
  subscribeAppLock,
} from "@/lib/applock";
import { useSession } from "@/lib/session";
import { colors, fonts, spacing } from "@/lib/theme";

// Renders the app once unlocked; otherwise shows a biometric lock screen. Only
// engages when the user enabled biometrics during onboarding (see lib/applock).
export function LockGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useSession();
  useSyncExternalStore(subscribeAppLock, appLockSnapshot, appLockSnapshot);

  const locked = isAuthenticated && isAppLockEnabled() && !isUnlocked();
  if (!locked) return <>{children}</>;
  return <LockScreen />;
}

function LockScreen() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const unlock = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [hasHardware, enrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      // Can't enforce the lock on this device — fail open rather than strand the user.
      if (!hasHardware || !enrolled) {
        markUnlocked();
        return;
      }
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Kinnectfi",
        disableDeviceFallback: false,
      });
      if (res.success) markUnlocked();
      else setError("Couldn't verify. Try again.");
    } catch {
      setError("Couldn't verify. Try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  // Prompt automatically on mount.
  useEffect(() => {
    void unlock();
  }, [unlock]);

  return (
    <View style={styles.root}>
      <Text style={styles.wordmark}>kinnectfi</Text>
      <Text style={styles.title}>Locked</Text>
      <Text style={styles.sub}>Unlock with Face ID, Touch ID, or your device passcode.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.button} onPress={unlock} disabled={busy}>
        {busy ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.buttonText}>Unlock</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  wordmark: { fontFamily: fonts.serif, fontSize: 32, color: colors.ink, marginBottom: spacing.xl },
  title: { fontFamily: fonts.serif, fontSize: 24, color: colors.ink },
  sub: { fontSize: 14, color: colors.inkSoft, textAlign: "center", maxWidth: 280 },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
  button: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    minWidth: 200,
    alignItems: "center",
  },
  buttonText: { color: colors.onPrimary, fontSize: 16, fontWeight: "600" },
});
