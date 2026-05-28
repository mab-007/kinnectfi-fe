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

const DOB = /^\d{4}-\d{2}-\d{2}$/;

// Format raw digits into YYYY-MM-DD as the user types (no native date-picker dep).
function formatDob(t: string): string {
  const d = t.replace(/\D/g, "").slice(0, 8);
  return [d.slice(0, 4), d.slice(4, 6), d.slice(6, 8)].filter(Boolean).join("-");
}

function ageInYears(dob: string): number {
  const d = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return Number.NaN;
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age -= 1;
  return age;
}

export default function Name() {
  const router = useRouter();
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dobValid = DOB.test(dob) && ageInYears(dob) >= 18 && ageInYears(dob) <= 120;
  const valid = firstName.trim().length > 0 && lastName.trim().length > 0 && dobValid;

  async function onContinue() {
    setSubmitting(true);
    setError(null);
    try {
      await api.saveProfile(
        { firstName: firstName.trim(), lastName: lastName.trim(), dateOfBirth: dob },
        idempotencyKey,
      );
      router.replace("/onboarding/tos");
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
          <Text style={styles.title}>Your legal name.</Text>
          <Text style={styles.sub}>
            Use the name on your government ID — it has to match for the verification step.
          </Text>

          <Text style={styles.label}>First name</Text>
          <TextInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="First name"
            placeholderTextColor={colors.inkFaint}
            autoCapitalize="words"
            autoFocus
          />

          <Text style={styles.label}>Last name</Text>
          <TextInput
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Last name"
            placeholderTextColor={colors.inkFaint}
            autoCapitalize="words"
          />

          <Text style={styles.label}>Date of birth</Text>
          <TextInput
            style={styles.input}
            value={dob}
            onChangeText={(t) => setDob(formatDob(t))}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.inkFaint}
            keyboardType="number-pad"
            maxLength={10}
          />
          {dob.length === 10 && !dobValid ? (
            <Text style={styles.hint}>You must be at least 18.</Text>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <Button
          label="Continue"
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
  hint: { fontSize: 13, color: colors.danger, marginTop: spacing.xs },
  error: { color: colors.danger, marginTop: spacing.md, fontSize: 14, textAlign: "center" },
});
