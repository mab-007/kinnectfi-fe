import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import {
  api,
  ApiError,
  newIdempotencyKey,
  type QuoteBody,
  type RemitDestination,
  type RemitQuote,
} from "@/lib/api";
import { formatPhp, formatUsdc, remitRailLabel } from "@/lib/format";
import { colors, fonts, radius, spacing } from "@/lib/theme";

// "50" / "50.25" dollars → USDC minor (6dp) string. Integer math, no float drift.
function dollarsToMinor(input: string): bigint {
  const cleaned = input.replace(/[^0-9.]/g, "");
  const [whole, frac = ""] = cleaned.split(".");
  const fracPadded = frac.slice(0, 6).padEnd(6, "0");
  return BigInt(whole || "0") * 1_000_000n + BigInt(fracPadded || "0");
}

const RAIL_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  gcash: "wallet-outline",
  maya: "wallet-outline",
  bank_instapay: "business-outline",
};

export default function ComposeRemit() {
  const router = useRouter();
  const [destinations, setDestinations] = useState<RemitDestination[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [railCode, setRailCode] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [bankCode, setBankCode] = useState<string | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [amount, setAmount] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [quote, setQuote] = useState<RemitQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState(0);
  const confirmKey = useRef<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { destinations: ds } = await api.getDestinations();
        if (cancelled) return;
        setDestinations(ds);
        setRailCode(ds.find((d) => d.available)?.rail ?? ds[0]?.rail ?? null);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof ApiError ? e.message : "Couldn't load destinations.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Tick the live 60s quote countdown while the sheet is open.
  useEffect(() => {
    if (!quote) return;
    setExpiresIn(quote.expiresInSec);
    const t = setInterval(() => {
      setExpiresIn((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [quote]);

  const selected = destinations?.find((d) => d.rail === railCode) ?? null;
  const isBank = selected?.handle.kind === "ph_bank_account";
  const bankOptions =
    selected?.handle.fields?.find((f) => f.key === "bankCode")?.options ?? [];

  function selectRail(code: string) {
    setRailCode(code);
    setFormError(null);
    // Clear handle inputs that don't apply to the new rail.
    setPhone("");
    setRecipientName("");
    setBankCode(null);
    setAccountNumber("");
    setAccountHolder("");
  }

  function buildQuoteBody(): QuoteBody | null {
    if (!selected) return null;
    const minor = dollarsToMinor(amount);
    if (minor <= 0n) {
      setFormError("Enter an amount to send.");
      return null;
    }
    const base: QuoteBody = { destRail: selected.rail, amountUsdc: minor.toString() };
    if (isBank) {
      if (!bankCode || !accountNumber.trim() || !accountHolder.trim()) {
        setFormError("Choose a bank and enter the account number and holder name.");
        return null;
      }
      return {
        ...base,
        destHandleStructured: {
          bankCode,
          accountNumber: accountNumber.trim(),
          accountHolderName: accountHolder.trim(),
        },
        destRecipientName: accountHolder.trim(),
      };
    }
    const handle = phone.replace(/\s/g, "");
    if (!handle) {
      setFormError("Enter the recipient's mobile number.");
      return null;
    }
    return {
      ...base,
      destHandle: handle,
      destRecipientName: recipientName.trim() || null,
    };
  }

  async function review() {
    if (quoting) return;
    setFormError(null);
    const body = buildQuoteBody();
    if (!body) return;
    setQuoting(true);
    try {
      const { quote: q } = await api.createQuote(body);
      confirmKey.current = newIdempotencyKey();
      setSheetError(null);
      setQuote(q);
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Couldn't price that transfer. Try again.");
    } finally {
      setQuoting(false);
    }
  }

  async function refreshQuote() {
    const body = buildQuoteBody();
    if (!body) return;
    setSheetError(null);
    setQuoting(true);
    try {
      const { quote: q } = await api.createQuote(body);
      confirmKey.current = newIdempotencyKey();
      setQuote(q);
    } catch (e) {
      setSheetError(e instanceof ApiError ? e.message : "Couldn't refresh the quote.");
    } finally {
      setQuoting(false);
    }
  }

  async function closeSheet() {
    const q = quote;
    setQuote(null);
    setSheetError(null);
    if (q && expiresIn > 0) {
      // Best-effort: free the active quote server-side. Ignore failures.
      api.cancelQuote(q.id).catch(() => {});
    }
  }

  async function confirm() {
    if (!quote || confirming || expiresIn <= 0) return;
    setSheetError(null);
    setConfirming(true);
    try {
      const res = await api.confirmRemit(quote.id, confirmKey.current);
      setQuote(null);
      router.replace(`/remit/${res.transactionId}?sent=1`);
    } catch (e) {
      setSheetError(e instanceof ApiError ? e.message : "Couldn't send. Your money was not moved.");
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const expired = expiresIn <= 0;
  const feeLabel = quote && quote.fees.totalFeeUsdc === "0" ? "Free" : quote ? formatUsdc(quote.fees.totalFeeUsdc) : "";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Send money</Text>
        <View style={{ width: 48 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex1}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {loadError ? <Text style={styles.error}>{loadError}</Text> : null}

          <Text style={styles.label}>Send to</Text>
          <View style={styles.railRow}>
            {(destinations ?? []).map((d) => {
              const active = d.rail === railCode;
              return (
                <Pressable
                  key={d.rail}
                  disabled={!d.available}
                  onPress={() => selectRail(d.rail)}
                  style={[styles.railPill, active && styles.railPillActive, !d.available && styles.railPillOff]}
                >
                  <Ionicons
                    name={RAIL_ICON[d.rail] ?? "send-outline"}
                    size={18}
                    color={active ? colors.onPrimary : colors.inkSoft}
                  />
                  <Text style={[styles.railText, active && styles.railTextActive]}>{d.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {selected ? (
            <>
              {isBank ? (
                <>
                  <Text style={styles.label}>Bank</Text>
                  <View style={styles.bankRow}>
                    {bankOptions.map((o) => {
                      const active = o.value === bankCode;
                      return (
                        <Pressable
                          key={o.value}
                          onPress={() => setBankCode(o.value)}
                          style={[styles.bankPill, active && styles.bankPillActive]}
                        >
                          <Text style={[styles.bankText, active && styles.bankTextActive]}>{o.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={styles.label}>Account number</Text>
                  <TextInput
                    style={styles.input}
                    value={accountNumber}
                    onChangeText={(t) => setAccountNumber(t.replace(/[^0-9]/g, ""))}
                    keyboardType="number-pad"
                    placeholder="10–14 digits"
                    placeholderTextColor={colors.inkFaint}
                  />
                  <Text style={styles.label}>Account holder name</Text>
                  <TextInput
                    style={styles.input}
                    value={accountHolder}
                    onChangeText={setAccountHolder}
                    placeholder="As registered with the bank"
                    placeholderTextColor={colors.inkFaint}
                    autoCapitalize="words"
                  />
                </>
              ) : (
                <>
                  <Text style={styles.label}>Mobile number</Text>
                  <TextInput
                    style={styles.input}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    placeholder={selected.handle.placeholder ?? "+63 9XX XXX XXXX"}
                    placeholderTextColor={colors.inkFaint}
                  />
                  <Text style={styles.label}>Recipient name (optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={recipientName}
                    onChangeText={setRecipientName}
                    placeholder="e.g. Maria Santos"
                    placeholderTextColor={colors.inkFaint}
                    autoCapitalize="words"
                  />
                </>
              )}

              <Text style={styles.label}>Amount</Text>
              <View style={styles.amountRow}>
                <Text style={styles.amountDollar}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ""))}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.inkFaint}
                />
              </View>
              <Text style={styles.hint}>{selected.settlementEstimate} · in US dollars (USDC)</Text>
            </>
          ) : null}

          {formError ? <Text style={styles.error}>{formError}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button label="Review transfer" onPress={review} loading={quoting} disabled={!selected} />
        </View>
      </KeyboardAvoidingView>

      <Modal visible={quote !== null} transparent animationType="slide" onRequestClose={closeSheet}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            {quote ? (
              <>
                <Text style={styles.sheetTitle}>Review transfer</Text>

                <View style={styles.amountSummary}>
                  <View style={styles.summaryHalf}>
                    <Text style={styles.summaryLabel}>You send</Text>
                    <Text style={styles.summaryBig}>{formatUsdc(quote.amountUsdc)}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={20} color={colors.inkFaint} />
                  <View style={styles.summaryHalf}>
                    <Text style={styles.summaryLabel}>They get</Text>
                    <Text style={styles.summaryBig}>{formatPhp(quote.recipientGetsPhp)}</Text>
                  </View>
                </View>

                <View style={styles.detailBlock}>
                  <DetailRow label="Exchange rate" value={`1 USD ≈ ₱${Number(quote.fxRate).toFixed(2)}`} />
                  <DetailRow label="Fee" value={feeLabel} />
                  <DetailRow label="Arrives" value={quote.settlementEstimate} />
                  <DetailRow
                    label="To"
                    value={`${quote.destRecipientName ? `${quote.destRecipientName} · ` : ""}${quote.destHandle} (${remitRailLabel(quote.destRail)})`}
                  />
                </View>

                {sheetError ? <Text style={styles.error}>{sheetError}</Text> : null}

                {expired ? (
                  <>
                    <Text style={styles.expired}>Quote expired — rates change every 60s.</Text>
                    <Button label="Refresh quote" onPress={refreshQuote} loading={quoting} />
                  </>
                ) : (
                  <>
                    <Text style={styles.countdown}>Rate held for {expiresIn}s</Text>
                    <Button label="Confirm & send" onPress={confirm} loading={confirming} />
                  </>
                )}
                <Pressable onPress={closeSheet} hitSlop={8} style={styles.cancel} disabled={confirming}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex1: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  back: { fontSize: 16, color: colors.primary, width: 48 },
  title: { fontFamily: fonts.serif, fontSize: 20, color: colors.ink },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  label: { fontSize: 13, color: colors.inkSoft, marginTop: spacing.md, marginBottom: spacing.xs },
  railRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  railPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  railPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  railPillOff: { opacity: 0.4 },
  railText: { fontSize: 14, color: colors.inkSoft, fontWeight: "500" },
  railTextActive: { color: colors.onPrimary },
  bankRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  bankPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  bankPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  bankText: { fontSize: 13, color: colors.inkSoft },
  bankTextActive: { color: colors.onPrimary },
  input: {
    backgroundColor: colors.field,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.ink,
  },
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
  amountInput: { flex: 1, fontSize: 28, color: colors.ink, paddingVertical: spacing.md, fontFamily: fonts.serif },
  hint: { fontSize: 12, color: colors.inkFaint, marginTop: spacing.xs },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
  // sheet
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
  amountSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  summaryHalf: { flex: 1, gap: spacing.xs },
  summaryLabel: { fontSize: 12, color: colors.inkFaint },
  summaryBig: { fontFamily: fonts.serif, fontSize: 22, color: colors.ink },
  detailBlock: { gap: spacing.sm },
  detailRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  detailLabel: { fontSize: 13, color: colors.inkSoft },
  detailValue: { fontSize: 13, color: colors.ink, flexShrink: 1, textAlign: "right" },
  countdown: { fontSize: 12, color: colors.inkFaint, textAlign: "center" },
  expired: { fontSize: 13, color: colors.danger, textAlign: "center" },
  cancel: { alignSelf: "center", paddingVertical: spacing.xs },
  cancelText: { color: colors.inkSoft, fontSize: 15 },
});
