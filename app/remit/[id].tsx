import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { api, ApiError, type RemitDetail } from "@/lib/api";
import { formatPhp, formatUsdc, remitRailLabel, remitStatusLabel } from "@/lib/format";
import { colors, fonts, radius, spacing } from "@/lib/theme";

const IN_PROGRESS = new Set(["authorized", "pending", "confirming"]);

function statusVisual(status: string): {
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  title: string;
} {
  if (status === "completed")
    return { icon: "checkmark-circle", tone: colors.success, title: "Delivered" };
  if (status === "failed" || status === "reversed")
    return { icon: "close-circle", tone: colors.danger, title: "Transfer failed" };
  return { icon: "time", tone: colors.inkSoft, title: "On the way" };
}

export default function RemitDetailScreen() {
  const router = useRouter();
  const { id, sent } = useLocalSearchParams<{ id: string; sent?: string }>();
  const [detail, setDetail] = useState<RemitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const polls = useRef(0);

  async function load() {
    try {
      const d = await api.getRemitDetail(id);
      setDetail(d);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load this transfer.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // While the payout is still in flight, poll a few times so a completion lands
  // without the user pulling to refresh.
  useEffect(() => {
    if (!detail || !IN_PROGRESS.has(detail.status) || polls.current >= 6) return;
    const t = setTimeout(() => {
      polls.current += 1;
      load();
    }, 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/send");
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

  const v = detail ? statusVisual(detail.status) : null;
  const justSent = sent === "1";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={goBack} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Transfer</Text>
        <View style={{ width: 48 }} />
      </View>

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
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {detail && v ? (
          <>
            <View style={styles.hero}>
              <Ionicons name={v.icon} size={56} color={v.tone} />
              <Text style={styles.heroTitle}>
                {justSent && detail.status !== "failed" ? "Money on the way!" : v.title}
              </Text>
              {detail.amountPhp ? (
                <Text style={styles.heroPhp}>{formatPhp(detail.amountPhp)}</Text>
              ) : null}
              <Text style={styles.heroSub}>
                {formatUsdc(detail.amountUsdc)} sent
                {detail.destRecipientName ? ` · to ${detail.destRecipientName}` : ""}
              </Text>
            </View>

            {detail.status === "failed" && detail.failureReason ? (
              <View style={styles.failBox}>
                <Text style={styles.failText}>
                  {detail.failureReason}. Your money has been returned to your balance.
                </Text>
              </View>
            ) : null}

            <View style={styles.detailBlock}>
              <Row label="Status" value={remitStatusLabel(detail.status)} />
              <Row label="To" value={`${detail.destHandle ?? "—"} (${remitRailLabel(detail.destRail)})`} />
              {detail.fees ? (
                <Row label="Fee" value={detail.fees.ourFeeUsdc === "0" ? "Free" : formatUsdc(detail.fees.ourFeeUsdc)} />
              ) : null}
              {detail.transfiOrderId ? <Row label="Reference" value={detail.transfiOrderId} /> : null}
            </View>

            {detail.timeline.length > 0 ? (
              <View style={styles.timeline}>
                <Text style={styles.sectionTitle}>Timeline</Text>
                {detail.timeline.map((t, i) => (
                  <View key={`${t.postedAt}-${i}`} style={styles.timelineRow}>
                    <View style={styles.timelineDot} />
                    <View style={styles.flex1}>
                      <Text style={styles.timelineDesc}>{t.description}</Text>
                      <Text style={styles.timelineTime}>{new Date(t.postedAt).toLocaleString()}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      {justSent ? (
        <View style={styles.footer}>
          <Button label="Done" onPress={() => router.replace("/send")} />
        </View>
      ) : null}
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
  heroTitle: { fontFamily: fonts.serif, fontSize: 24, color: colors.ink, marginTop: spacing.sm },
  heroPhp: { fontFamily: fonts.serif, fontSize: 32, color: colors.ink },
  heroSub: { fontSize: 14, color: colors.inkSoft, textAlign: "center" },
  failBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  failText: { fontSize: 13, color: colors.inkSoft, lineHeight: 19 },
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
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 5,
  },
  timelineDesc: { fontSize: 14, color: colors.ink },
  timelineTime: { fontSize: 12, color: colors.inkFaint },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  error: { color: colors.danger, fontSize: 13 },
});
