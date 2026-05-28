import { useRouter } from "expo-router";
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
import { getDevWalletAddress } from "@/lib/auth";
import { colors, fonts, radius, spacing } from "@/lib/theme";

const E164 = /^\+[1-9]\d{7,14}$/;

export default function Contact() {
  const router = useRouter();
  const [phone, setPhone] = useState("+1");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phoneValid = E164.test(phone.trim());

  async function onContinue() {
    setError(null);
    setSubmitting(true);
    try {
      const walletAddress = await getDevWalletAddress();
      const res = await api.signup({
        walletAddress,
        phoneE164: phone.trim(),
        email: email.trim() ? email.trim() : undefined,
        deviceId: `${Platform.OS}-dev`,
      });
      router.push({
        pathname: "/onboarding/otp",
        params: {
          challengeId: res.otpChallengeId,
          phone: res.user.phoneE164 ?? phone.trim(),
        },
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
          <Text style={styles.title}>How can we reach you?</Text>
          <Text style={styles.sub}>
            We'll text a code to confirm it's you. Standard rates may apply.
          </Text>

          <Text style={styles.label}>Mobile number</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+1 (415) 555-1234"
            placeholderTextColor={colors.inkFaint}
            keyboardType="phone-pad"
            autoFocus
          />

          <Text style={styles.label}>Email (optional)</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.inkFaint}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <Button
          label="Send code"
          onPress={onContinue}
          disabled={!phoneValid}
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
  label: {
    fontSize: 13,
    color: colors.inkSoft,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.field,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 52,
    fontSize: 16,
    color: colors.ink,
  },
  error: { color: colors.danger, marginTop: spacing.md, fontSize: 14 },
});
