import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { api, ApiError, newIdempotencyKey, type StartKycBody } from "@/lib/api";
import { colors, fonts, radius, spacing } from "@/lib/theme";

// NOTE: these option lists are placeholders matching formats Rain accepted in
// sandbox. Replace with Rain's official SOC / salary / purpose / volume enums.
const SALARY = ["0-25000", "25000-50000", "50000-100000", "100000-250000", "250000+"];
const VOLUME = ["0-1000", "1000-5000", "5000-10000", "10000+"];
const PURPOSE = ["web3Payments", "personalUse", "remittance"];
const OCCUPATION: { code: string; label: string }[] = [
  { code: "15-1252", label: "Software Developer" },
  { code: "11-1021", label: "Manager" },
  { code: "13-2011", label: "Accountant" },
  { code: "41-3091", label: "Sales" },
  { code: "43-9061", label: "Office / Admin" },
];

// TODO: real device fingerprint from the Iovation (TransUnion) SDK — required by
// Rain in production. Sandbox accepts a placeholder; wire the native SDK before go-live.
function devIovationBlackbox(): string {
  return `${Platform.OS}-dev-blackbox-${Date.now()}`;
}

function Chips({
  options,
  value,
  onChange,
}: {
  options: { code: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map((o) => (
        <Pressable
          key={o.code}
          style={[styles.chip, value === o.code && styles.chipOn]}
          onPress={() => onChange(o.code)}
        >
          <Text style={[styles.chipText, value === o.code && styles.chipTextOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function Kyc() {
  const router = useRouter();
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ssn, setSsn] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("1");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [occupation, setOccupation] = useState(OCCUPATION[0].code);
  const [annualSalary, setAnnualSalary] = useState(SALARY[2]);
  const [accountPurpose, setAccountPurpose] = useState(PURPOSE[0]);
  const [expectedMonthlyVolume, setExpectedMonthlyVolume] = useState(VOLUME[1]);

  const ssnValid = /^\d{9}$/.test(ssn);
  const phoneValid = /^\d{4,15}$/.test(phoneNumber);
  const addressValid = Boolean(line1 && city && region && postalCode);
  const formValid = ssnValid && phoneValid && addressValid;

  async function onSubmit() {
    if (!formValid) return;
    setSubmitting(true);
    setError(null);
    const body: StartKycBody = {
      ssn,
      phoneCountryCode,
      phoneNumber,
      occupation,
      annualSalary,
      accountPurpose,
      expectedMonthlyVolume,
      iovationBlackbox: devIovationBlackbox(),
      address: {
        line1,
        line2: line2 || undefined,
        city,
        region,
        postalCode,
        countryCode: "US",
        country: "United States",
      },
    };
    try {
      const res = await api.startKyc(body, idempotencyKey);
      if (res.completionLink) {
        router.replace({
          pathname: "/onboarding/kyc-verify",
          params: {
            url: res.completionLink.url,
            params: JSON.stringify(res.completionLink.params),
          },
        });
      } else {
        router.replace("/onboarding/kyc-status");
      }
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
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Verify your identity.</Text>
          <Text style={styles.sub}>
            Required to open your account. Your info goes straight to our regulated
            partner — we don't store your SSN.
          </Text>

          <Text style={styles.label}>Social Security Number</Text>
          <TextInput
            style={styles.input}
            value={ssn}
            onChangeText={(t) => setSsn(t.replace(/\D/g, "").slice(0, 9))}
            placeholder="9 digits"
            placeholderTextColor={colors.inkFaint}
            keyboardType="number-pad"
            secureTextEntry
          />

          <Text style={styles.label}>Mobile number</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.cc]}
              value={phoneCountryCode}
              onChangeText={(t) => setPhoneCountryCode(t.replace(/\D/g, "").slice(0, 3))}
              keyboardType="number-pad"
            />
            <TextInput
              style={[styles.input, styles.flex]}
              value={phoneNumber}
              onChangeText={(t) => setPhoneNumber(t.replace(/\D/g, "").slice(0, 15))}
              placeholder="4155550123"
              placeholderTextColor={colors.inkFaint}
              keyboardType="number-pad"
            />
          </View>

          <Text style={styles.label}>Residential address</Text>
          <TextInput
            style={styles.input}
            value={line1}
            onChangeText={setLine1}
            placeholder="Street address"
            placeholderTextColor={colors.inkFaint}
          />
          <TextInput
            style={[styles.input, styles.mt]}
            value={line2}
            onChangeText={setLine2}
            placeholder="Apt, suite (optional)"
            placeholderTextColor={colors.inkFaint}
          />
          <View style={[styles.row, styles.mt]}>
            <TextInput
              style={[styles.input, styles.flex]}
              value={city}
              onChangeText={setCity}
              placeholder="City"
              placeholderTextColor={colors.inkFaint}
            />
            <TextInput
              style={[styles.input, styles.state]}
              value={region}
              onChangeText={(t) => setRegion(t.toUpperCase().slice(0, 2))}
              placeholder="TX"
              placeholderTextColor={colors.inkFaint}
              autoCapitalize="characters"
            />
          </View>
          <TextInput
            style={[styles.input, styles.mt]}
            value={postalCode}
            onChangeText={(t) => setPostalCode(t.replace(/\D/g, "").slice(0, 5))}
            placeholder="ZIP code"
            placeholderTextColor={colors.inkFaint}
            keyboardType="number-pad"
          />
          <Text style={styles.hint}>United States</Text>

          <Text style={styles.label}>Occupation</Text>
          <Chips options={OCCUPATION} value={occupation} onChange={setOccupation} />

          <Text style={styles.label}>Annual income (USD)</Text>
          <Chips
            options={SALARY.map((s) => ({ code: s, label: `$${s}` }))}
            value={annualSalary}
            onChange={setAnnualSalary}
          />

          <Text style={styles.label}>Expected monthly volume (USD)</Text>
          <Chips
            options={VOLUME.map((v) => ({ code: v, label: `$${v}` }))}
            value={expectedMonthlyVolume}
            onChange={setExpectedMonthlyVolume}
          />

          <Text style={styles.label}>Account purpose</Text>
          <Chips
            options={PURPOSE.map((p) => ({ code: p, label: p }))}
            value={accountPurpose}
            onChange={setAccountPurpose}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>

        <Button
          label="Continue to verification"
          onPress={onSubmit}
          disabled={!formValid}
          loading={submitting}
          style={{ marginVertical: spacing.md }}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingBottom: spacing.lg },
  title: { fontFamily: fonts.serif, fontSize: 26, color: colors.ink, marginTop: spacing.lg },
  sub: { fontSize: 15, lineHeight: 22, color: colors.inkSoft, marginTop: spacing.sm },
  label: { fontSize: 13, color: colors.inkSoft, marginTop: spacing.lg, marginBottom: spacing.xs },
  hint: { fontSize: 12, color: colors.inkFaint, marginTop: spacing.xs },
  row: { flexDirection: "row", gap: spacing.sm },
  mt: { marginTop: spacing.sm },
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
  cc: { width: 64, textAlign: "center" },
  state: { width: 72, textAlign: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.field,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, color: colors.ink },
  chipTextOn: { color: colors.onPrimary, fontWeight: "600" },
  error: { color: colors.danger, marginTop: spacing.md, fontSize: 14, textAlign: "center" },
});
