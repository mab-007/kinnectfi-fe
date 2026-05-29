import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TabHeader } from "@/components/TabHeader";
import { api, ApiError, type TxView } from "@/lib/api";
import { formatDate, formatUsdc, txLabel } from "@/lib/format";
import { colors, spacing } from "@/lib/theme";

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

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          await loadPage();
        } catch (e) {
          if (active) setError(e instanceof ApiError ? e.message : "Couldn't load activity.");
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [loadPage]),
  );

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
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.headerWrap}>
        <TabHeader title="Activity" />
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
            const incoming = item.direction === "credit";
            return (
              <Pressable style={styles.row} onPress={() => router.push(`/tx/${item.id}`)}>
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
              </Pressable>
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
  headerWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs },
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
  in: { color: colors.success },
  out: { color: colors.inkSoft },
  muted: { color: colors.inkSoft, fontSize: 14, textAlign: "center", marginTop: spacing.xl },
  error: { color: colors.danger, fontSize: 13, textAlign: "center" },
});
