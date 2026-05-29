import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { TabHeader } from "@/components/TabHeader";
import { api, ApiError, newIdempotencyKey, type YieldStatusResponse } from "@/lib/api";
import { formatUsdc } from "@/lib/format";
import { colors, fonts, radius, spacing } from "@/lib/theme";

// "50" / "50.25" dollars → USDC minor (6dp) string. Integer math, no float drift.
function dollarsToMinor(input: string): bigint {
  const cleaned = input.replace(/[^0-9.]/g, "");
  const [whole, frac = ""] = cleaned.split(".");
  const fracPadded = frac.slice(0, 6).padEnd(6, "0");
  return BigInt(whole || "0") * 1_000_000n + BigInt(fracPadded || "0");
}

type SheetMode = "deposit" | "withdraw" | null;

export default function Save() {
  const [status, setStatus] = useState<YieldStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sheet, setSheet] = useState<SheetMode>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setStatus(await api.getYield());
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load your savings.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function openSheet(mode: SheetMode) {
    setAmount("");
    setSheetError(null);
    setSheet(mode);
  }

  async function submit(all = false) {
    if (busy) return;
    setSheetError(null);
    const minor = all ? 0n : dollarsToMinor(amount);
    if (!all && minor <= 0n) {
      setSheetError("Enter an amount.");
      return;
    }
    setBusy(true);
    try {
      if (sheet === "deposit") {
        await api.yieldDeposit(minor.toString(), newIdempotencyKey());
      } else {
        await api.yieldWithdraw(all ? { all: true } : { amountMinor: minor.toString() }, newIdempotencyKey());
      }
      setSheet(null);
      await load();
    } catch (e) {
      setSheetError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // Counsel gate OFF → coming-soon. Eligible-but-gated users never see the product.
  if (!status?.enabled) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.body}>
          <TabHeader title="Save" />
          <View style={styles.center}>
            <Ionicons name="trending-up-outline" size={48} color={colors.primary} />
            <Text style={styles.headline}>Earn on idle dollars.</Text>
            <Text style={styles.sub}>
              Put money you're not sending yet to work and earn yield automatically. Coming soon.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const apyPct = (status.indicativeApyBps / 100).toFixed(1);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <TabHeader title="Save" />
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!status.eligible ? (
          <View style={styles.cardMuted}>
            <Text style={styles.mutedText}>Finish identity verification to start earning.</Text>
          </View>
        ) : status.hasPosition ? (
          <>
            <View style={styles.valueCard}>
              <Text style={styles.valueLabel}>Saved & earning</Text>
              <Text style={styles.valueBig}>{formatUsdc(status.currentValueMinor)}</Text>
              <View style={styles.accruedRow}>
                <Ionicons name="arrow-up-circle" size={16} color={colors.success} />
                <Text style={styles.accrued}>
                  +{formatUsdc(status.accruedMinor)} earned · ~{apyPct}% APY
                </Text>
              </View>
              <Text style={styles.principalNote}>
                {formatUsdc(status.principalMinor)} deposited · {status.vaultName}
              </Text>
            </View>
            <View style={styles.actions}>
              <Button label="Add to savings" onPress={() => openSheet("deposit")} style={styles.flex1} />
              <Button label="Withdraw" variant="ghost" onPress={() => openSheet("withdraw")} style={styles.flex1} />
            </View>
          </>
        ) : (
          <>
            <View style={styles.valueCard}>
              <Ionicons name="trending-up-outline" size={40} color={colors.primary} />
              <Text style={styles.headline}>Earn ~{apyPct}% on idle dollars</Text>
              <Text style={styles.sub}>
                Move dollars you're not sending yet into {status.vaultName} and earn yield automatically.
                Withdraw anytime.
              </Text>
              <Text style={styles.principalNote}>{formatUsdc(status.availableMinor)} available to move</Text>
            </View>
            <Button label="Start earning" onPress={() => openSheet("deposit")} />
          </>
        )}

        <Text style={styles.footnote}>
          Yield is opt-in and earned through a DeFi protocol (Morpho on Base) — returns vary and aren't
          guaranteed. Your funds stay in your own wallet.
        </Text>
      </ScrollView>

      <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.sheetBackdrop}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{sheet === "deposit" ? "Add to savings" : "Withdraw"}</Text>
            <Text style={styles.sheetBody}>
              {sheet === "deposit"
                ? `${formatUsdc(status.availableMinor)} available to move`
                : `${formatUsdc(status.currentValueMinor)} currently saved`}
            </Text>
            <View style={styles.amountRow}>
              <Text style={styles.amountDollar}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ""))}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.inkFaint}
                autoFocus
              />
            </View>
            {sheetError ? <Text style={styles.error}>{sheetError}</Text> : null}
            <Button
              label={sheet === "deposit" ? "Move to savings" : "Withdraw"}
              onPress={() => submit(false)}
              loading={busy}
            />
            {sheet === "withdraw" ? (
              <Button label="Withdraw all" variant="ghost" onPress={() => submit(true)} disabled={busy} />
            ) : null}
            <Pressable onPress={() => setSheet(null)} hitSlop={8} style={styles.cancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    flexGrow: 1,
  },
  title: { fontFamily: fonts.serif, fontSize: 26, color: colors.ink },
  headline: { fontFamily: fonts.serif, fontSize: 22, color: colors.ink, textAlign: "center" },
  sub: { fontSize: 14, color: colors.inkSoft, textAlign: "center", lineHeight: 21, maxWidth: 320 },
  valueCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    alignItems: "center",
  },
  valueLabel: { fontSize: 13, color: colors.inkFaint },
  valueBig: { fontFamily: fonts.serif, fontSize: 40, color: colors.ink },
  accruedRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  accrued: { fontSize: 14, color: colors.success, fontWeight: "600" },
  principalNote: { fontSize: 12, color: colors.inkFaint, marginTop: spacing.xs },
  actions: { flexDirection: "row", gap: spacing.md },
  flex1: { flex: 1 },
  cardMuted: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  mutedText: { color: colors.inkSoft, fontSize: 14 },
  footnote: { fontSize: 12, color: colors.inkFaint, marginTop: spacing.md, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13 },
  // bottom sheet
  sheetBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },
  sheetTitle: { fontFamily: fonts.serif, fontSize: 20, color: colors.ink },
  sheetBody: { fontSize: 14, color: colors.inkSoft },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.field,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  amountDollar: { fontSize: 28, color: colors.inkSoft, fontFamily: fonts.serif },
  amountInput: {
    flex: 1,
    fontSize: 28,
    color: colors.ink,
    paddingVertical: spacing.md,
    fontFamily: fonts.serif,
  },
  cancel: { alignSelf: "center", paddingVertical: spacing.xs },
  cancelText: { color: colors.inkSoft, fontSize: 15 },
});
