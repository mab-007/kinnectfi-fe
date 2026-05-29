import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { api, ApiError, type CardTxnView, type CardView, newIdempotencyKey } from "@/lib/api";
import { cardStatusLabel, declineReasonLabel, formatDate, formatUsdc } from "@/lib/format";
import { colors, fonts, radius, spacing } from "@/lib/theme";

type PinIntent = "reveal" | "replace";

export default function CardScreen() {
  const router = useRouter();
  const [card, setCard] = useState<CardView | null>(null);
  const [canIssue, setCanIssue] = useState(false);
  const [feed, setFeed] = useState<CardTxnView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pinIntent, setPinIntent] = useState<PinIntent | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinBusy, setPinBusy] = useState(false);

  // Activation (D31): a not_activated card prompts a bottom sheet with a single
  // "Enable online transactions" toggle (default ON). Auto-presented once on first
  // sight of a dormant card; also reachable from the "Activate card" CTA.
  const [activateOpen, setActivateOpen] = useState(false);
  const [onlineOn, setOnlineOn] = useState(true);
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);
  const autoPromptedRef = useRef(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.getCards();
      const live = res.cards.find((c) => c.status !== "canceled") ?? null;
      setCard(live);
      setCanIssue(res.canIssue);
      if (live) {
        const txns = await api.getCardTransactions(live.id, { limit: 20 });
        setFeed(txns.transactions);
      } else {
        setFeed([]);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load your card.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload on focus so a card issued from the PDP flow shows on return.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openActivate = () => {
    setOnlineOn(true);
    setActivateError(null);
    setActivateOpen(true);
  };

  // Auto-present the activation sheet once when a dormant card is first loaded.
  useEffect(() => {
    if (card?.status === "not_activated" && !autoPromptedRef.current) {
      autoPromptedRef.current = true;
      openActivate();
    }
  }, [card]);

  const activate = useCallback(async () => {
    if (!card) return;
    setActivating(true);
    setActivateError(null);
    try {
      const res = await api.activateCard(card.id, onlineOn);
      setCard({ ...card, status: res.status });
      setActivateOpen(false);
    } catch (e) {
      setActivateError(e instanceof ApiError ? e.message : "Couldn't activate your card. Try again.");
    } finally {
      setActivating(false);
    }
  }, [card, onlineOn]);

  const toggleFreeze = useCallback(async () => {
    if (!card) return;
    setBusy(true);
    setError(null);
    try {
      const res = card.status === "frozen" ? await api.unfreezeCard(card.id) : await api.freezeCard(card.id);
      setCard({ ...card, status: res.status, frozenByUser: res.status === "frozen" });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }, [card]);

  const openPin = (intent: PinIntent) => {
    setPinIntent(intent);
    setPin("");
    setPinError(null);
  };

  const submitPin = useCallback(async () => {
    if (!card || !pinIntent || pin.length !== 6) return;
    setPinBusy(true);
    setPinError(null);
    try {
      if (pinIntent === "reveal") {
        const session = await api.revealCard(card.id, pin);
        setPinIntent(null);
        if (session.mode === "hosted_iframe" && session.revealUrl) {
          router.push({ pathname: "/card-reveal", params: { url: session.revealUrl } });
        } else {
          Alert.alert("Reveal", "Secure reveal is not available on this build yet.");
        }
      } else {
        await api.replaceCard(card.id, pin, "lost", newIdempotencyKey());
        setPinIntent(null);
        await load();
        Alert.alert("Card replaced", "Your old card was canceled and a new one issued.");
      }
    } catch (e) {
      setPinError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setPinBusy(false);
    }
  }, [card, pinIntent, pin, router, load]);

  const confirmReplace = () => {
    Alert.alert(
      "Replace card?",
      "Your current card will be canceled and a new one issued. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Replace", style: "destructive", onPress: () => openPin("replace") },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // No live card → product PDP (issuable) or a not-yet-verified note.
  if (!card) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.pdpScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Card</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {canIssue ? (
            <>
              <View style={styles.heroCard}>
                <View style={styles.heroTop}>
                  <Text style={styles.heroLogo}>kinnectfi</Text>
                  <Ionicons name="wifi" size={20} color={colors.onPrimary} style={styles.heroWifi} />
                </View>
                <View style={styles.heroChip} />
                <View style={styles.heroBottom}>
                  <Text style={styles.heroBrandSub}>DEBIT</Text>
                  <Text style={styles.heroBrand}>VISA</Text>
                </View>
              </View>

              <Text style={styles.pdpHeading}>A card built for OFWs</Text>
              <Text style={styles.pdpBody}>
                Earn yield on your balance, get cashback on every swipe, spend seamlessly in the US
                and PH, and share access with family back home.
              </Text>

              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, styles.statValueAccent]}>4%</Text>
                  <Text style={styles.statLabel}>APY</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>1%</Text>
                  <Text style={styles.statLabel}>cashback</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>3</Text>
                  <Text style={styles.statLabel}>min setup</Text>
                </View>
              </View>

              <Button label="Explore benefits" onPress={() => router.push("/card-benefits")} />
              <Text style={styles.disclaimer}>
                KinnectFi Visa debit card is issued by Rain. Subject to approval and applicable terms.
              </Text>
            </>
          ) : (
            <Text style={styles.muted}>
              Your card will be available once your account is verified.
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const frozen = card.status === "frozen";
  const notActivated = card.status === "not_activated";
  const revealable = card.status === "active" || card.status === "not_activated";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.bodyScroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Your card</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={[styles.card, frozen && styles.cardFrozen]}>
          <View style={styles.cardRow}>
            <Text style={styles.cardBrand}>{card.brand.toUpperCase()}</Text>
            <Text style={[styles.cardStatus, frozen && styles.cardStatusFrozen]}>
              {cardStatusLabel(card.status)}
            </Text>
          </View>
          <Text style={styles.cardNumber}>•••• •••• •••• {card.last4}</Text>
          <View style={styles.cardRow}>
            <Text style={styles.cardName}>{card.cardholderName}</Text>
            <Text style={styles.cardExp}>
              {String(card.expMonth).padStart(2, "0")}/{String(card.expYear).slice(-2)}
            </Text>
          </View>
        </View>

        {notActivated ? <Text style={styles.activateHint}>Turn on your card to start spending.</Text> : null}

        <View style={styles.actions}>
          {notActivated ? (
            <Button label="Activate card" onPress={openActivate} />
          ) : (
            <Button label={frozen ? "Unfreeze card" : "Freeze card"} variant="ghost" onPress={toggleFreeze} loading={busy} />
          )}
          <Button label="Reveal card details" variant="ghost" onPress={() => openPin("reveal")} disabled={!revealable} />
          <Button label="Report lost / replace" variant="ghost" onPress={confirmReplace} />
        </View>

        <View style={styles.feed}>
          <Text style={styles.feedTitle}>Recent activity</Text>
          {feed.length === 0 ? (
            <Text style={styles.feedEmpty}>No card activity yet.</Text>
          ) : (
            feed.map((t) => {
              const declined = t.decision === "declined";
              return (
                <View key={t.id} style={styles.feedRow}>
                  <View style={styles.feedRowLeft}>
                    <Text style={styles.feedMerchant} numberOfLines={1}>
                      {t.merchant.name ?? "Card transaction"}
                    </Text>
                    <Text style={[styles.feedSub, declined && styles.feedSubDeclined]}>
                      {declined
                        ? declineReasonLabel(t.declineReason)
                        : t.status === "settled"
                          ? "Purchase"
                          : t.status === "reversed"
                            ? "Reversed"
                            : "Pending"}
                      {" · "}
                      {formatDate(t.occurredAt)}
                    </Text>
                  </View>
                  <Text style={[styles.feedAmount, declined && styles.feedAmountDeclined]}>
                    -{formatUsdc(t.amount)}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal visible={activateOpen} transparent animationType="slide" onRequestClose={() => setActivateOpen(false)}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Turn on your card</Text>
            <Text style={styles.sheetBody}>
              Your card is ready. Enable transactions to start spending online and in your wallet.
            </Text>
            <View style={styles.toggleRow}>
              <View style={styles.toggleText}>
                <Text style={styles.toggleLabel}>Enable online transactions</Text>
                <Text style={styles.toggleHint}>You can change this anytime.</Text>
              </View>
              <Switch
                value={onlineOn}
                onValueChange={setOnlineOn}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>
            {activateError ? <Text style={styles.error}>{activateError}</Text> : null}
            <Button label="Confirm" onPress={activate} loading={activating} />
            <Button label="Not now" variant="ghost" onPress={() => setActivateOpen(false)} />
          </View>
        </View>
      </Modal>

      <Modal visible={pinIntent !== null} transparent animationType="fade" onRequestClose={() => setPinIntent(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {pinIntent === "reveal" ? "Enter your PIN to reveal" : "Enter your PIN to replace"}
            </Text>
            <TextInput
              style={styles.pinInput}
              value={pin}
              onChangeText={(t) => setPin(t.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              autoFocus
              placeholder="••••••"
              placeholderTextColor={colors.inkFaint}
            />
            {pinError ? <Text style={styles.error}>{pinError}</Text> : null}
            <Button label="Confirm" onPress={submitPin} loading={pinBusy} disabled={pin.length !== 6} />
            <Button label="Cancel" variant="ghost" onPress={() => setPinIntent(null)} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  bodyScroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  title: { fontFamily: fonts.serif, fontSize: 26, color: colors.ink },

  // ── recent activity feed (§2.7) ──
  feed: { gap: spacing.sm },
  feedTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
  feedEmpty: { color: colors.inkSoft, fontSize: 14 },
  feedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  feedRowLeft: { flex: 1, gap: 2 },
  feedMerchant: { color: colors.ink, fontSize: 15, fontWeight: "600" },
  feedSub: { color: colors.inkSoft, fontSize: 13 },
  feedSubDeclined: { color: colors.danger },
  feedAmount: { color: colors.ink, fontSize: 15, fontWeight: "600" },
  feedAmountDeclined: { color: colors.inkFaint, textDecorationLine: "line-through" },

  // ── PDP (no card yet) ──
  pdpScroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.lg },
  heroCard: {
    backgroundColor: colors.ink,
    borderRadius: radius.lg,
    padding: spacing.lg,
    aspectRatio: 1.6,
    justifyContent: "space-between",
  },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroLogo: { color: colors.onPrimary, fontSize: 20, fontWeight: "700", letterSpacing: 0.5 },
  heroWifi: { transform: [{ rotate: "90deg" }] },
  heroChip: { width: 44, height: 32, borderRadius: 6, backgroundColor: "#C9A24B" },
  heroBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  heroBrandSub: { color: colors.inkFaint, fontSize: 11, letterSpacing: 2 },
  heroBrand: { color: colors.onPrimary, fontSize: 20, fontWeight: "800", fontStyle: "italic", letterSpacing: 1 },
  pdpHeading: { fontFamily: fonts.serif, fontSize: 30, color: colors.ink, lineHeight: 36 },
  pdpBody: { color: colors.inkSoft, fontSize: 15, lineHeight: 22 },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
  },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statDivider: { width: 1, alignSelf: "stretch", backgroundColor: colors.border },
  statValue: { fontSize: 22, fontWeight: "700", color: colors.ink },
  statValueAccent: { color: colors.success },
  statLabel: { fontSize: 12, color: colors.inkSoft },
  disclaimer: { color: colors.inkFaint, fontSize: 12, lineHeight: 17, textAlign: "center" },
  card: { backgroundColor: colors.ink, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  cardFrozen: { opacity: 0.6 },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardBrand: { color: colors.onPrimary, fontSize: 14, fontWeight: "700", letterSpacing: 1 },
  cardStatus: { color: colors.inkFaint, fontSize: 12, fontWeight: "600" },
  cardStatusFrozen: { color: colors.primaryDisabled },
  cardNumber: { color: colors.onPrimary, fontSize: 22, letterSpacing: 3, marginVertical: spacing.md },
  cardName: { color: colors.inkFaint, fontSize: 14 },
  cardExp: { color: colors.inkFaint, fontSize: 14 },
  actions: { gap: spacing.sm },
  activateHint: { color: colors.inkSoft, fontSize: 14, textAlign: "center" },
  muted: { color: colors.inkSoft, fontSize: 14, textAlign: "center", marginTop: spacing.xl },
  error: { color: colors.danger, fontSize: 13, textAlign: "center" },

  // ── activation bottom sheet (D31) ──
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: spacing.sm,
  },
  sheetTitle: { fontFamily: fonts.serif, fontSize: 22, color: colors.ink },
  sheetBody: { color: colors.inkSoft, fontSize: 15, lineHeight: 21 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  toggleText: { flex: 1, gap: 2 },
  toggleLabel: { color: colors.ink, fontSize: 16, fontWeight: "600" },
  toggleHint: { color: colors.inkFaint, fontSize: 13 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", paddingHorizontal: spacing.lg },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  modalTitle: { fontFamily: fonts.serif, fontSize: 20, color: colors.ink, textAlign: "center" },
  pinInput: {
    backgroundColor: colors.field,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: "center",
    paddingVertical: spacing.md,
    color: colors.ink,
  },
});
