import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { api, ApiError, type TransactionDetail } from "@/lib/api";
import { formatDate, formatUsdc, txLabel } from "@/lib/format";
import { colors, fonts, radius, spacing } from "@/lib/theme";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  authorized: "Processing",
  settled: "Completed",
  completed: "Completed",
  failed: "Failed",
  reversed: "Reversed",
};

function statusVisual(status: string): { icon: keyof typeof Ionicons.glyphMap; tone: string } {
  if (status === "completed" || status === "settled")
    return { icon: "checkmark-circle", tone: colors.success };
  if (status === "failed" || status === "reversed")
    return { icon: "close-circle", tone: colors.danger };
  return { icon: "time", tone: colors.inkSoft };
}

export default function TransactionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getTransaction(id)
      .then((d) => active && setDetail(d))
      .catch((e) => active && setError(e instanceof ApiError ? e.message : "Couldn't load this transaction."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/activity");
  }

  const t = detail?.transaction;
  const credit = t?.direction === "credit";
  const v = t ? statusVisual(t.status) : null;
  const isRemit = t?.kind === "remit" || t?.kind === "remit_failed";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={goBack} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Transaction</Text>
        <View style={{ width: 48 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error || !t || !v ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error ?? "Transaction not found."}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.hero}>
            <Ionicons name={v.icon} size={52} color={v.tone} />
            <Text style={[styles.amount, credit ? styles.amountIn : styles.amountOut]}>
              {credit ? "+" : "-"}
              {formatUsdc(t.grossAmount)}
            </Text>
            <Text style={styles.kind}>{txLabel(t.kind)}</Text>
          </View>

          <View style={styles.detailBlock}>
            <Row label="Status" value={STATUS_LABELS[t.status] ?? t.status} />
            <Row label="Date" value={formatDate(t.initiatedAt)} />
            {t.vendor ? <Row label="Provider" value={t.vendor} /> : null}
            {t.vendorExternalId ? <Row label="Reference" value={t.vendorExternalId} /> : null}
          </View>

          {detail.timeline.length > 0 ? (
            <View style={styles.timeline}>
              <Text style={styles.sectionTitle}>Timeline</Text>
              {detail.timeline.map((p, i) => (
                <View key={`${p.postedAt}-${i}`} style={styles.timelineRow}>
                  <View style={styles.timelineDot} />
                  <View style={styles.flex1}>
                    <Text style={styles.timelineDesc}>{p.description}</Text>
                    <Text style={styles.timelineTime}>{new Date(p.postedAt).toLocaleString()}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {isRemit ? (
            <Button label="View transfer details" variant="ghost" onPress={() => router.push(`/remit/${t.id}`)} />
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
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
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  hero: { alignItems: "center", gap: spacing.xs, paddingVertical: spacing.lg },
  amount: { fontFamily: fonts.serif, fontSize: 36, marginTop: spacing.sm },
  amountIn: { color: colors.success },
  amountOut: { color: colors.ink },
  kind: { fontSize: 15, color: colors.inkSoft },
  detailBlock: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  rowLabel: { fontSize: 13, color: colors.inkSoft },
  rowValue: { fontSize: 13, color: colors.ink, flexShrink: 1, textAlign: "right" },
  timeline: { gap: spacing.sm },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: colors.ink },
  timelineRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 5 },
  timelineDesc: { fontSize: 14, color: colors.ink },
  timelineTime: { fontSize: 12, color: colors.inkFaint },
  error: { color: colors.danger, fontSize: 13, textAlign: "center" },
});
