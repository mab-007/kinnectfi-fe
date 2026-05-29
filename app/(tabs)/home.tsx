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
import { api, ApiError, type BalanceResponse, type CardView, type TxView } from "@/lib/api";
import {
  formatDate,
  formatPhpFromUsdcMinor,
  formatUsdc,
  initialsOf,
  PHP_PER_USD,
  txLabel,
} from "@/lib/format";
import { colors, fonts, radius, spacing } from "@/lib/theme";

const INCOMING = new Set(["fund_in", "crypto_deposit", "yield_accrual"]);

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState<{ first: string | null; last: string | null }>({ first: null, last: null });
  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const [card, setCard] = useState<CardView | null>(null);
  const [txns, setTxns] = useState<TxView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [state, bal, cards, history] = await Promise.all([
        api.getState(),
        api.getBalance(),
        api.getCards(),
        api.getTransactions({ limit: 6 }),
      ]);
      setName({ first: state.user.legalFirstName, last: state.user.legalLastName });
      setBalance(bal);
      setCard(cards.cards.find((c) => c.status !== "canceled") ?? null);
      setTxns(history.transactions);
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
          <Pressable style={styles.avatar} onPress={() => router.push("/profile")} hitSlop={8}>
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
            <Pressable style={[styles.action, styles.actionGhost]} onPress={() => router.push("/send")}>
              <Ionicons name="paper-plane-outline" size={16} color={colors.onPrimary} />
              <Text style={styles.actionGhostText}>Send</Text>
            </Pressable>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Card + Save mini tiles */}
        <View style={styles.tiles}>
          <Pressable style={styles.tile} onPress={() => router.push("/card")}>
            <View style={styles.tileTop}>
              <Text style={styles.tileLabel}>CARD</Text>
              <Ionicons name="card-outline" size={16} color={colors.inkFaint} />
            </View>
            <Text style={styles.tileAmount}>{card ? "$0.00" : "—"}</Text>
            <Text style={styles.tileSub}>{card ? "Spent this month" : "Setting up"}</Text>
          </Pressable>
          <Pressable style={styles.tile} onPress={() => router.push("/save")}>
            <View style={styles.tileTop}>
              <Text style={styles.tileLabel}>SAVE · 5%</Text>
              <Ionicons name="trending-up" size={16} color={colors.primary} />
            </View>
            <Text style={styles.tileAmount}>$0.00</Text>
            <Text style={styles.tileSub}>Tap Save tab to earn</Text>
          </Pressable>
        </View>

        {/* Recent activity */}
        <View style={styles.activityHeader}>
          <Text style={styles.sectionTitle}>Recent activity</Text>
          {txns.length > 0 ? (
            <Pressable onPress={() => router.push("/activity")}>
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
            const incoming = INCOMING.has(t.kind);
            return (
              <View key={t.id} style={styles.txRow}>
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
              </View>
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
  txIn: { color: colors.ink },
  txOut: { color: colors.inkSoft },
  error: { color: colors.danger, fontSize: 13 },
});
