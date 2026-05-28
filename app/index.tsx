import { usePrivy } from "@privy-io/expo";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { api, ApiError } from "@/lib/api";
import { stepToRoute } from "@/lib/onboarding";
import { colors, fonts, spacing } from "@/lib/theme";

export default function Welcome() {
  const router = useRouter();
  const { isReady, user, logout } = usePrivy();
  const [resumeError, setResumeError] = useState<string | null>(null);

  // If a Privy session already exists, skip login and resume at the right
  // onboarding step (driven by the backend) instead of showing the entry CTA.
  useEffect(() => {
    if (!isReady || !user) return;
    let cancelled = false;
    api
      .getState()
      .then((s) => {
        if (!cancelled) router.replace(stepToRoute(s.user.onboardingStep));
      })
      .catch((e) => {
        if (!cancelled) {
          setResumeError(e instanceof ApiError ? e.message : "Couldn't resume your session.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isReady, user]);

  // Booting Privy, or logged in and resuming → spinner (no CTA flash).
  if (!isReady || (user && !resumeError)) {
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
      <View style={styles.hero}>
        <Text style={styles.wordmark}>kinnectfi</Text>
        <Text style={styles.headline}>The financial home for Filipinos abroad.</Text>
        <Text style={styles.sub}>
          Free remittance. Real banking. Built for the way you support family.
        </Text>
      </View>

      <View style={styles.footer}>
        {resumeError ? <Text style={styles.error}>{resumeError}</Text> : null}
        <Text style={styles.legal}>By continuing you agree to our Terms & Privacy Notice.</Text>
        <Button label="Get started" onPress={() => router.push("/onboarding/contact")} />
        {user ? (
          <Button
            label="Log out"
            variant="ghost"
            onPress={() => logout()}
            style={{ marginTop: spacing.xs }}
          />
        ) : (
          <Button
            label="I already have an account"
            variant="ghost"
            onPress={() => router.push("/onboarding/contact")}
            style={{ marginTop: spacing.xs }}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  hero: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.md },
  wordmark: { fontFamily: fonts.serif, fontSize: 40, color: colors.ink, marginBottom: spacing.xl },
  headline: {
    fontFamily: fonts.serif,
    fontSize: 26,
    lineHeight: 34,
    color: colors.ink,
    textAlign: "center",
  },
  sub: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.inkSoft,
    textAlign: "center",
    marginTop: spacing.md,
    maxWidth: 300,
  },
  footer: { gap: spacing.sm, paddingBottom: spacing.md },
  legal: {
    fontSize: 12,
    color: colors.inkFaint,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  error: { color: colors.danger, fontSize: 13, textAlign: "center", marginBottom: spacing.sm },
});
