import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  api,
  ApiError,
  type AchAccountResponse,
  type FundInMethod,
} from "@/lib/api";
import { formatUsdc } from "@/lib/format";
import { colors, fonts, radius, spacing } from "@/lib/theme";

const REASON_COPY: Record<string, string> = {
  kyc_not_approved: "Finish identity verification to add money.",
  account_frozen: "Your account is temporarily on hold. Contact support.",
  state_not_supported_for_ach: "Bank transfers aren't available in your state yet.",
  coming_soon: "Coming soon.",
};

export default function AddMoney() {
  const router = useRouter();
  const [ach, setAch] = useState<FundInMethod | null>(null);
  const [crypto, setCrypto] = useState<FundInMethod | null>(null);
  const [account, setAccount] = useState<AchAccountResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await api.getFundInMethods();
        if (cancelled) return;
        const achM = m.methods.find((x) => x.kind === "ach_push") ?? null;
        setAch(achM);
        setCrypto(m.methods.find((x) => x.kind === "crypto_deposit") ?? null);
        if (achM?.available) {
          const acct = await api.getFundInAccount();
          if (!cancelled) setAccount(acct);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Couldn't load fund-in options.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Add money</Text>
        <View style={{ width: 48 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* ACH bank transfer */}
          <Text style={styles.sectionTitle}>Bank transfer (ACH)</Text>
          {ach?.available && account ? (
            <View style={styles.card}>
              <Field label="Bank" value={account.achAccount.bankPartnerName} />
              <Field label="Account holder" value={account.achAccount.accountHolderName} />
              <Field label="Routing number" value={account.achAccount.routingNumber} mono />
              <Field label="Account number" value={account.achAccount.accountNumber} mono />
              <Text style={styles.instructions}>{account.instructions}</Text>
              <Text style={styles.meta}>
                Up to {formatUsdc(account.limits.perTransactionMax ?? "0")} per transfer ·{" "}
                {account.settlementEstimate}
              </Text>
            </View>
          ) : (
            <View style={styles.cardMuted}>
              <Text style={styles.mutedText}>
                {REASON_COPY[ach?.ineligibleReason ?? ""] ?? "Bank transfers are unavailable right now."}
              </Text>
            </View>
          )}

          {/* Crypto deposit */}
          <Text style={styles.sectionTitle}>Crypto deposit (USDC on Base)</Text>
          <View style={styles.cardMuted}>
            <Text style={styles.mutedText}>
              {crypto?.available ? "Send USDC on Base." : REASON_COPY[crypto?.ineligibleReason ?? "coming_soon"]}
            </Text>
          </View>

          <Text style={styles.footnote}>
            Money you send appears in your balance once it clears. We'll notify you.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text selectable style={[styles.fieldValue, mono && styles.mono]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  back: { color: colors.primary, fontSize: 16, width: 48 },
  title: { fontFamily: fonts.serif, fontSize: 20, color: colors.ink },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: colors.ink, marginTop: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardMuted: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  mutedText: { color: colors.inkSoft, fontSize: 14 },
  field: { gap: 2 },
  fieldLabel: { fontSize: 12, color: colors.inkFaint },
  fieldValue: { fontSize: 16, color: colors.ink },
  mono: { fontVariant: ["tabular-nums"], letterSpacing: 1 },
  instructions: { fontSize: 13, color: colors.inkSoft, lineHeight: 19 },
  meta: { fontSize: 12, color: colors.inkFaint },
  footnote: { fontSize: 12, color: colors.inkFaint, marginTop: spacing.md, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13 },
});
