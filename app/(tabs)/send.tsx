import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
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
import { TabHeader } from "@/components/TabHeader";
import { api, ApiError, type RemitDestination, type RemitHistoryItem } from "@/lib/api";
import {
  formatDate,
  formatUsdc,
  remitRailLabel,
  remitStatusLabel,
} from "@/lib/format";
import { colors, fonts, radius, spacing } from "@/lib/theme";

const GATE_COPY: Record<string, string> = {
  capability_remit_disabled: "Finish identity verification to send money home.",
  account_frozen: "Your account is on hold. Contact support to send money.",
};

function statusTone(status: string): string {
  if (status === "completed") return colors.success;
  if (status === "failed" || status === "reversed") return colors.danger;
  return colors.inkSoft;
}

// A normal transfer sends money out (up/out arrow). A failed/refunded transfer
// returns money to the wallet (down/in arrow), so the icon should reflect that.
function rowIcon(status: string): { name: keyof typeof Ionicons.glyphMap; tone: string } {
  if (status === "failed" || status === "reversed")
    return { name: "arrow-down", tone: colors.success };
  return { name: "arrow-up", tone: colors.primary };
}

export default function Send() {
  const router = useRouter();
  const [destinations, setDestinations] = useState<RemitDestination[] | null>(null);
  const [history, setHistory] = useState<RemitHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [dests, hist] = await Promise.all([
        api.getDestinations(),
        api.getRemitHistory({ limit: 20 }),
      ]);
      setDestinations(dests.destinations);
      setHistory(hist.remits);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load your transfers.");
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

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const eligible = (destinations ?? []).some((d) => d.available);
  const gateReason = (destinations ?? []).find((d) => d.ineligibleReason)?.ineligibleReason ?? null;

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
        <TabHeader title="Send" />
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!eligible ? (
          <View style={styles.center}>
            <Ionicons name="paper-plane-outline" size={48} color={colors.inkFaint} />
            <Text style={styles.headline}>Send money home</Text>
            <Text style={styles.sub}>
              {GATE_COPY[gateReason ?? ""] ??
                "Free transfers to GCash, Maya, and bank accounts in the Philippines."}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.hero}>
              <Ionicons name="paper-plane" size={36} color={colors.primary} />
              <Text style={styles.headline}>Send money to the Philippines</Text>
              <Text style={styles.sub}>
                To GCash, Maya, or a bank account. Arrives in minutes.
              </Text>
            </View>
            <Button label="Send money" onPress={() => router.push("/remit/compose")} />

            <View style={styles.recentHeader}>
              <Text style={styles.sectionTitle}>Recent transfers</Text>
            </View>
            {history.length === 0 ? (
              <View style={styles.cardMuted}>
                <Text style={styles.mutedText}>
                  No transfers yet — your sent money will show up here.
                </Text>
              </View>
            ) : (
              <View style={styles.list}>
                {history.map((h) => (
                  <Pressable
                    key={h.transactionId}
                    style={styles.row}
                    onPress={() => router.push(`/remit/${h.transactionId}`)}
                  >
                    <View style={styles.rowIcon}>
                      <Ionicons name={rowIcon(h.status).name} size={18} color={rowIcon(h.status).tone} />
                    </View>
                    <View style={styles.rowMid}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {h.destRecipientName ?? h.destHandle ?? remitRailLabel(h.destRail)}
                      </Text>
                      <Text style={styles.rowSub}>
                        {remitRailLabel(h.destRail)} · {formatDate(h.createdAt)}
                      </Text>
                    </View>
                    <View style={styles.rowRight}>
                      <Text style={styles.rowAmount}>{formatUsdc(h.amountUsdc)}</Text>
                      <Text style={[styles.rowStatus, { color: statusTone(h.status) }]}>
                        {remitStatusLabel(h.status)}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
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
  hero: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    alignItems: "center",
  },
  headline: { fontFamily: fonts.serif, fontSize: 22, color: colors.ink, textAlign: "center" },
  sub: { fontSize: 14, color: colors.inkSoft, textAlign: "center", lineHeight: 21, maxWidth: 320 },
  recentHeader: { marginTop: spacing.md },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: colors.ink },
  list: { gap: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  rowMid: { flex: 1, gap: 2 },
  rowName: { fontSize: 15, color: colors.ink, fontWeight: "500" },
  rowSub: { fontSize: 12, color: colors.inkFaint },
  rowRight: { alignItems: "flex-end", gap: 2 },
  rowAmount: { fontSize: 15, color: colors.ink, fontWeight: "600" },
  rowStatus: { fontSize: 12 },
  cardMuted: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  mutedText: { color: colors.inkSoft, fontSize: 14 },
  error: { color: colors.danger, fontSize: 13 },
});
