import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, ApiError, type TxView } from "@/lib/api";
import { formatDate, formatUsdc, txLabel } from "@/lib/format";
import { colors, fonts, spacing } from "@/lib/theme";

const INCOMING = new Set(["fund_in", "crypto_deposit", "yield_accrual"]);
const PAGE = 25;

export default function Activity() {
  const router = useRouter();
  const [txns, setTxns] = useState<TxView[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async (after?: string) => {
    const res = await api.getTransactions({ limit: PAGE, cursor: after });
    setTxns((prev) => (after ? [...prev, ...res.transactions] : res.transactions));
    setCursor(res.nextCursor);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await loadPage();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Couldn't load activity.");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadPage]);

  const onEnd = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      await loadPage(cursor);
    } catch {
      /* keep what we have */
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, loadPage]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Activity</Text>
        <View style={{ width: 48 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={txns}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.body}
          onEndReached={onEnd}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={<Text style={styles.muted}>No activity yet.</Text>}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} /> : null}
          renderItem={({ item }) => {
            const incoming = INCOMING.has(item.kind);
            return (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{txLabel(item.kind)}</Text>
                  <Text style={styles.meta}>
                    {formatDate(item.initiatedAt)} · {item.status}
                  </Text>
                </View>
                <Text style={[styles.amount, incoming ? styles.in : styles.out]}>
                  {incoming ? "+" : "-"}
                  {formatUsdc(item.grossAmount)}
                </Text>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
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
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: { fontSize: 15, color: colors.ink },
  meta: { fontSize: 12, color: colors.inkFaint, marginTop: 2, textTransform: "capitalize" },
  amount: { fontSize: 15, fontWeight: "600" },
  in: { color: colors.ink },
  out: { color: colors.inkSoft },
  muted: { color: colors.inkSoft, fontSize: 14, textAlign: "center", marginTop: spacing.xl },
  error: { color: colors.danger, fontSize: 13, textAlign: "center" },
});
