import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { api, ApiError, type KycState } from "@/lib/api";
import { colors, fonts, spacing } from "@/lib/theme";

const ACTION_NEEDED = new Set(["needsVerification", "needsInformation", "notStarted"]);

export default function KycStatus() {
  const router = useRouter();
  const [state, setState] = useState<KycState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const s = await api.refreshKyc();
        if (cancelled.current) return;
        setState(s);
        const step = s.onboardingStep;
        if (step === "complete" || step === "kyc_approved" || step === "provisioning") {
          router.replace("/onboarding/done");
          return;
        }
        if (step === "kyc_rejected") return; // terminal
        attempts += 1;
        if (attempts < 12) timer = setTimeout(poll, 5000);
      } catch (e) {
        if (!cancelled.current) {
          setError(e instanceof ApiError ? e.message : "Couldn't check your status.");
        }
      }
    }
    poll();
    return () => {
      cancelled.current = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  function resume() {
    if (!state?.completionLink) return;
    router.replace({
      pathname: "/onboarding/kyc-verify",
      params: {
        url: state.completionLink.url,
        params: JSON.stringify(state.completionLink.params),
      },
    });
  }

  const rejected = state?.onboardingStep === "kyc_rejected";
  const needsAction = state?.rainStatus ? ACTION_NEEDED.has(state.rainStatus) : false;

  return (
    <Screen>
      <View style={styles.body}>
        {rejected ? (
          <>
            <Text style={styles.title}>We couldn't verify you.</Text>
            <Text style={styles.sub}>
              {state?.reason ||
                "Your application wasn't approved. Contact support if you think this is a mistake."}
            </Text>
          </>
        ) : error ? (
          <>
            <Text style={styles.title}>Something went wrong.</Text>
            <Text style={styles.sub}>{error}</Text>
          </>
        ) : needsAction ? (
          <>
            <Text style={styles.title}>Finish your verification.</Text>
            <Text style={styles.sub}>
              We still need a bit more to confirm your identity. Pick up where you left off.
            </Text>
          </>
        ) : (
          <>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.title}>Reviewing your verification.</Text>
            <Text style={styles.sub}>
              This usually takes under a minute. We'll move you forward automatically.
            </Text>
          </>
        )}
      </View>

      {rejected ? (
        <Button
          label="Back to start"
          variant="ghost"
          onPress={() => router.replace("/")}
          style={{ marginBottom: spacing.md }}
        />
      ) : needsAction && state?.completionLink ? (
        <Button label="Resume verification" onPress={resume} style={{ marginBottom: spacing.md }} />
      ) : error ? (
        <Button
          label="Try again"
          onPress={() => router.replace("/onboarding/kyc-status")}
          style={{ marginBottom: spacing.md }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.md },
  title: {
    fontFamily: fonts.serif,
    fontSize: 24,
    color: colors.ink,
    marginTop: spacing.md,
    textAlign: "center",
  },
  sub: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.inkSoft,
    textAlign: "center",
    maxWidth: 320,
  },
});
