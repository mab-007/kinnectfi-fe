import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { api, ApiError } from "@/lib/api";
import { colors, fonts, radius, spacing } from "@/lib/theme";

export default function Otp() {
  const router = useRouter();
  const { challengeId, phone } = useLocalSearchParams<{
    challengeId: string;
    phone?: string;
  }>();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const codeValid = /^\d{6}$/.test(code);

  async function onVerify() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.verifyOtp(challengeId, code);
      router.replace({
        pathname: "/onboarding/done",
        params: { step: res.user.onboardingStep },
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.flex}>
          <Text style={styles.title}>Enter the code we just texted.</Text>
          <Text style={styles.sub}>
            Sent to {phone ?? "your number"}. It expires in a few minutes.
          </Text>

          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
            placeholder="••••••"
            placeholderTextColor={colors.inkFaint}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />

          <Text style={styles.devHint}>Dev mode: the code is 000000.</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <Button
          label="Verify"
          onPress={onVerify}
          disabled={!codeValid}
          loading={submitting}
          style={{ marginBottom: spacing.md }}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { fontFamily: fonts.serif, fontSize: 26, color: colors.ink, marginTop: spacing.lg },
  sub: { fontSize: 15, lineHeight: 22, color: colors.inkSoft, marginTop: spacing.sm },
  codeInput: {
    backgroundColor: colors.field,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    height: 64,
    marginTop: spacing.xl,
    fontSize: 30,
    letterSpacing: 12,
    textAlign: "center",
    color: colors.ink,
  },
  devHint: { fontSize: 13, color: colors.inkFaint, marginTop: spacing.md, textAlign: "center" },
  error: { color: colors.danger, marginTop: spacing.md, fontSize: 14, textAlign: "center" },
});
