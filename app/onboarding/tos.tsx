import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { api, ApiError, newIdempotencyKey, type OnboardingState } from "@/lib/api";
import { colors, fonts, radius, spacing } from "@/lib/theme";

export default function Tos() {
  const router = useRouter();
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [legal, setLegal] = useState<OnboardingState["legal"] | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getState()
      .then((s) => setLegal(s.legal))
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : "Couldn't load the terms."),
      );
  }, []);

  async function onAgree() {
    if (!legal) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.acceptTos(legal.version, idempotencyKey);
      router.replace("/onboarding/biometric");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <View style={styles.flex}>
        <Text style={styles.title}>A few legal things.</Text>
        <Text style={styles.sub}>
          Please review and accept these to continue. We'll record the version and date.
        </Text>

        {legal ? (
          <>
            <Pressable
              style={styles.linkRow}
              onPress={() => Linking.openURL(legal.termsUrl)}
            >
              <Text style={styles.linkText}>Terms of Service</Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
            <Pressable
              style={styles.linkRow}
              onPress={() => Linking.openURL(legal.privacyUrl)}
            >
              <Text style={styles.linkText}>Privacy Policy</Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>

            <Pressable style={styles.agreeRow} onPress={() => setAgreed((v) => !v)}>
              <View style={[styles.checkbox, agreed && styles.checkboxOn]}>
                {agreed ? <Text style={styles.checkMark}>✓</Text> : null}
              </View>
              <Text style={styles.agreeText}>
                I agree to the Terms of Service and Privacy Policy.
              </Text>
            </Pressable>
            <Text style={styles.version}>Version {legal.version}</Text>
          </>
        ) : !error ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <Button
        label="Agree and continue"
        onPress={onAgree}
        disabled={!agreed || !legal}
        loading={submitting}
        style={{ marginBottom: spacing.md }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { fontFamily: fonts.serif, fontSize: 26, color: colors.ink, marginTop: spacing.lg },
  sub: { fontSize: 15, lineHeight: 22, color: colors.inkSoft, marginTop: spacing.sm },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.field,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 52,
    marginTop: spacing.md,
  },
  linkText: { fontSize: 16, color: colors.primary, fontWeight: "600" },
  chevron: { fontSize: 22, color: colors.inkFaint },
  agreeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkMark: { color: colors.onPrimary, fontSize: 15, fontWeight: "700" },
  agreeText: { flex: 1, fontSize: 15, lineHeight: 21, color: colors.ink },
  version: { fontSize: 12, color: colors.inkFaint, marginTop: spacing.md },
  error: { color: colors.danger, marginTop: spacing.md, fontSize: 14, textAlign: "center" },
});
