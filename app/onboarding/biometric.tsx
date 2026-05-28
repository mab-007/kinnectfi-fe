import { useRouter } from "expo-router";
import * as Application from "expo-application";
import * as LocalAuthentication from "expo-local-authentication";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { api, ApiError, newIdempotencyKey } from "@/lib/api";
import { colors, fonts, spacing } from "@/lib/theme";

// Optional, non-gating step shown right after ToS: offer to turn on device
// biometrics. The BE records enrollment but never blocks onboarding on it, so
// "Skip" and "Enable" both land on the done screen.
async function getDeviceId(): Promise<string> {
  try {
    if (Platform.OS === "ios") {
      return (await Application.getIosIdForVendorAsync()) ?? "ios-unknown";
    }
    return Application.getAndroidId() ?? "android-unknown";
  } catch {
    return `${Platform.OS}-unknown`;
  }
}

export default function Biometric() {
  const router = useRouter();
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [checking, setChecking] = useState(true);
  const [available, setAvailable] = useState(false);
  const [label, setLabel] = useState("biometrics");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [hasHardware, enrolled, types] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
          LocalAuthentication.supportedAuthenticationTypesAsync(),
        ]);
        if (cancelled) return;
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setLabel("Face ID");
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setLabel(Platform.OS === "ios" ? "Touch ID" : "fingerprint");
        }
        setAvailable(hasHardware && enrolled);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function goToDone() {
    router.replace({ pathname: "/onboarding/done", params: { step: "tos_accepted" } });
  }

  async function onEnable() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: `Enable ${label}`,
        cancelLabel: "Not now",
        disableDeviceFallback: false,
      });
      if (!res.success) {
        setError("Couldn't verify. You can skip and turn this on later in Settings.");
        return;
      }
      await api.enrollBiometric(await getDeviceId(), idempotencyKey);
      goToDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.flex}>
        <View style={styles.icon}>
          <Text style={styles.iconGlyph}>{label === "Face ID" ? "☺" : "☝"}</Text>
        </View>
        <Text style={styles.title}>Lock it down with {label}.</Text>
        <Text style={styles.sub}>
          {available
            ? `Use ${label} to unlock Kinnectfi and approve payments — faster than a PIN, and only you can do it.`
            : "Biometrics aren't set up on this device. You can turn this on later in Settings once you add Face ID or a fingerprint."}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      {available ? (
        <Button
          label={`Enable ${label}`}
          onPress={onEnable}
          loading={submitting}
          style={{ marginBottom: spacing.sm }}
        />
      ) : null}
      <Button
        label={available ? "Skip for now" : "Continue"}
        variant="ghost"
        onPress={goToDone}
        disabled={submitting}
        style={{ marginBottom: spacing.md }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.field,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xl,
  },
  iconGlyph: { fontSize: 34, color: colors.primary },
  title: {
    fontFamily: fonts.serif,
    fontSize: 26,
    color: colors.ink,
    marginTop: spacing.lg,
  },
  sub: { fontSize: 15, lineHeight: 22, color: colors.inkSoft, marginTop: spacing.sm, maxWidth: 340 },
  error: { color: colors.danger, marginTop: spacing.md, fontSize: 14 },
});
