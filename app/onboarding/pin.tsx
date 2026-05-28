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
import { api, ApiError, newIdempotencyKey } from "@/lib/api";
import { colors, fonts, radius, spacing } from "@/lib/theme";

type Phase = "create" | "confirm";

export default function Pin() {
  const router = useRouter();
  // One key per mount: a genuine retry of the same PIN replays safely; a 4xx
  // (e.g. too-weak) isn't cached, so correcting the PIN and resubmitting works.
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [phase, setPhase] = useState<Phase>("create");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = phase === "create" ? pin : confirm;
  const setValue = phase === "create" ? setPin : setConfirm;
  const valid = /^\d{6}$/.test(value);

  function onChange(t: string) {
    setError(null);
    setValue(t.replace(/\D/g, "").slice(0, 6));
  }

  async function onContinue() {
    if (phase === "create") {
      setPhase("confirm");
      return;
    }
    if (confirm !== pin) {
      setError("Those didn't match. Try again.");
      setConfirm("");
      setPhase("create");
      setPin("");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.setPin(pin, idempotencyKey);
      router.replace("/onboarding/name");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Something went wrong.";
      setError(msg);
      // Weak PIN or any rejection: send them back to re-pick.
      setConfirm("");
      setPin("");
      setPhase("create");
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
          <Text style={styles.title}>
            {phase === "create" ? "Set a 6-digit PIN." : "Confirm your PIN."}
          </Text>
          <Text style={styles.sub}>
            {phase === "create"
              ? "You'll use it to unlock the app and approve sensitive actions."
              : "Type it once more so we know it stuck."}
          </Text>

          <TextInput
            key={phase}
            style={styles.codeInput}
            value={value}
            onChangeText={onChange}
            placeholder="••••••"
            placeholderTextColor={colors.inkFaint}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            autoFocus
          />

          <Text style={styles.hint}>
            Avoid obvious ones like 123456 or 111111.
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <Button
          label={phase === "create" ? "Continue" : "Set PIN"}
          onPress={onContinue}
          disabled={!valid}
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
  hint: { fontSize: 13, color: colors.inkFaint, marginTop: spacing.md, textAlign: "center" },
  error: { color: colors.danger, marginTop: spacing.md, fontSize: 14, textAlign: "center" },
});
