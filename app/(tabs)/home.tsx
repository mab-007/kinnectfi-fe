import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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
import {
  api,
  ApiError,
  type BalanceResponse,
  type CardView,
  type TxView,
  type YieldStatusResponse,
} from "@/lib/api";
import {
  cardStatusLabel,
  formatDate,
  formatPhpFromUsdcMinor,
  formatUsdc,
  initialsOf,
  PHP_PER_USD,
  txLabel,
} from "@/lib/format";
import { colors, fonts, radius, spacing } from "@/lib/theme";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState<{ first: string | null; last: string | null }>({ first: null, last: null });
  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const [card, setCard] = useState<CardView | null>(null);
  const [yieldStatus, setYieldStatus] = useState<YieldStatusResponse | null>(null);
  const [txns, setTxns] = useState<TxView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [state, bal, cards, history, yld] = await Promise.all([
        api.getState(),
        api.getBalance(),
        api.getCards(),
        api.getTransactions({ limit: 6 }),
        api.getYield().catch(() => null),
      ]);
      setName({ first: state.user.legalFirstName, last: state.user.legalLastName });
      setBalance(bal);
      setCard(cards.cards.find((c) => c.status !== "canceled") ?? null);
      setTxns(history.transactions);
      setYieldStatus(yld);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load your account.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const spendable = balance?.totals.spendableUsdc ?? "0";
  const firstName = name.first ?? "there";

  // Save tile: real saved value when the user has a position, otherwise the
  // indicative rate as a hook. Never a hardcoded $0.00.
  const apyPct = yieldStatus ? (yieldStatus.indicativeApyBps / 100).toFixed(1) : "5";
  const saveTile =
    yieldStatus?.enabled && yieldStatus.hasPosition
      ? { amount: formatUsdc(yieldStatus.currentValueMinor), sub: `Saved · ~${apyPct}% APY` }
      : { amount: `~${apyPct}%`, sub: yieldStatus?.enabled ? "Tap to start earning" : "Coming soon" };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Greeting + avatar */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.eyebrow}>MAGANDANG ARAW</Text>
            <Text style={styles.name}>{firstName}</Text>
          </View>
          <Pressable style={styles.avatar} onPress={() => router.push("/menu")} hitSlop={8}>
            <Text style={styles.avatarText}>{initialsOf(name.first, name.last)}</Text>
          </Pressable>
        </View>

        {/* USD wallet */}
        <View style={styles.wallet}>
          <View style={styles.walletTop}>
            <Text style={styles.walletLabel}>USD WALLET</Text>
            <View style={styles.badge}>
              <Ionicons name="shield-checkmark" size={12} color={colors.onPrimary} />
              <Text style={styles.badgeText}>Verified</Text>
            </View>
          </View>
          <Text style={styles.amount}>{formatUsdc(spendable)}</Text>
          <Text style={styles.amountSub}>
            ≈ {formatPhpFromUsdcMinor(spendable)}   ·   1 USD = ₱{PHP_PER_USD.toFixed(2)}
          </Text>
          <View style={styles.walletActions}>
            <Pressable style={[styles.action, styles.actionPrimary]} onPress={() => router.push("/add-money")}>
              <Ionicons name="add" size={18} color={colors.onPrimary} />
              <Text style={styles.actionPrimaryText}>Add money</Text>
            </Pressable>
            <Pressable style={[styles.action, styles.actionGhost]} onPress={() => router.navigate("/send")}>
              <Ionicons name="paper-plane-outline" size={16} color={colors.onPrimary} />
              <Text style={styles.actionGhostText}>Send</Text>
            </Pressable>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Card + Save mini tiles */}
        <View style={styles.tiles}>
          <Pressable style={styles.tile} onPress={() => router.navigate("/card")}>
            <View style={styles.tileTop}>
              <Text style={styles.tileLabel}>CARD</Text>
              <Ionicons name="card-outline" size={16} color={colors.inkFaint} />
            </View>
            <Text style={styles.tileAmount}>{card ? `•• ${card.last4}` : "Get a card"}</Text>
            <Text style={styles.tileSub}>{card ? cardStatusLabel(card.status) : "Tap to set up"}</Text>
          </Pressable>
          <Pressable style={styles.tile} onPress={() => router.navigate("/save")}>
            <View style={styles.tileTop}>
              <Text style={styles.tileLabel}>SAVE</Text>
              <Ionicons name="trending-up" size={16} color={colors.primary} />
            </View>
            <Text style={styles.tileAmount}>{saveTile.amount}</Text>
            <Text style={styles.tileSub}>{saveTile.sub}</Text>
          </Pressable>
        </View>

        {/* Recent activity */}
        <View style={styles.activityHeader}>
          <Text style={styles.sectionTitle}>Recent activity</Text>
          {txns.length > 0 ? (
            <Pressable onPress={() => router.navigate("/activity")}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          ) : null}
        </View>
        {txns.length === 0 ? (
          <View style={styles.emptyTile}>
            <Text style={styles.emptyText}>No activity yet — when you add or send money, it'll show up here.</Text>
          </View>
        ) : (
          txns.map((t) => {
            const incoming = t.direction === "credit";
            return (
              <Pressable key={t.id} style={styles.txRow} onPress={() => router.push(`/tx/${t.id}`)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txLabel}>{txLabel(t.kind)}</Text>
                  <Text style={styles.txMeta}>
                    {formatDate(t.initiatedAt)} · {t.status}
                  </Text>
                </View>
                <Text style={[styles.txAmount, incoming ? styles.txIn : styles.txOut]}>
                  {incoming ? "+" : "-"}
                  {formatUsdc(t.grossAmount)}
                </Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl, gap: spacing.md },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eyebrow: { fontSize: 11, letterSpacing: 1, color: colors.inkFaint, fontWeight: "600" },
  name: { fontFamily: fonts.serif, fontSize: 26, color: colors.ink },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 14, fontWeight: "700", color: colors.inkSoft },
  wallet: { backgroundColor: colors.ink, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs },
  walletTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  walletLabel: { color: colors.inkFaint, fontSize: 12, fontWeight: "600", letterSpacing: 1 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  badgeText: { color: colors.onPrimary, fontSize: 11, fontWeight: "600" },
  amount: { fontFamily: fonts.serif, fontSize: 44, color: colors.onPrimary, marginTop: spacing.sm },
  amountSub: { color: colors.inkFaint, fontSize: 13 },
  walletActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  action: { flex: 1, height: 46, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  actionPrimary: { backgroundColor: colors.primary },
  actionPrimaryText: { color: colors.onPrimary, fontSize: 15, fontWeight: "600" },
  actionGhost: { backgroundColor: "rgba(255,255,255,0.12)" },
  actionGhostText: { color: colors.onPrimary, fontSize: 15, fontWeight: "600" },
  tiles: { flexDirection: "row", gap: spacing.sm },
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 2,
  },
  tileTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
  tileLabel: { fontSize: 11, fontWeight: "700", color: colors.inkFaint, letterSpacing: 0.5 },
  tileAmount: { fontSize: 20, fontWeight: "700", color: colors.ink },
  tileSub: { fontSize: 12, color: colors.inkFaint },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: colors.ink },
  activityHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.sm },
  seeAll: { color: colors.primary, fontSize: 13, fontWeight: "600" },
  emptyTile: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  emptyText: { color: colors.inkSoft, fontSize: 14, textAlign: "center", lineHeight: 20 },
  txRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  txLabel: { fontSize: 15, color: colors.ink },
  txMeta: { fontSize: 12, color: colors.inkFaint, marginTop: 2, textTransform: "capitalize" },
  txAmount: { fontSize: 15, fontWeight: "600" },
  txIn: { color: colors.success },
  txOut: { color: colors.inkSoft },
  error: { color: colors.danger, fontSize: 13 },
});
