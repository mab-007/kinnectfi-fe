import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Button } from "@/components/Button";
import { TabHeader } from "@/components/TabHeader";
import {
  api,
  ApiError,
  type CardTxnView,
  type CardView,
  newIdempotencyKey,
  type ReplaceReason,
} from "@/lib/api";
import { cardStatusLabel, declineReasonLabel, formatDate, formatUsdc } from "@/lib/format";
import { colors, fonts, radius, spacing } from "@/lib/theme";

type PinIntent = "reveal" | "replace";

// In-screen reveal. For the sandbox/fake issuer the reveal "session" is a local
// stub URL we can't load, so we surface a clearly-simulated full PAN inline; for
// a real Rain hosted reveal we embed the secure page in-screen (never a new tab).
interface RevealedCard {
  number: string;
  cvc: string;
  exp: string;
}
const REPLACE_REASONS: { value: ReplaceReason; label: string }[] = [
  { value: "lost", label: "Lost" },
  { value: "stolen", label: "Stolen" },
  { value: "damaged", label: "Damaged" },
];

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

  // In-screen reveal state (Task: reveal inline). Exactly one of these is set.
  const [revealed, setRevealed] = useState<RevealedCard | null>(null);
  const [revealUrl, setRevealUrl] = useState<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Report-lost / replace bottom sheet (Task: replace as sheet).
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceReason, setReplaceReason] = useState<ReplaceReason>("lost");

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

  const hideReveal = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = null;
    setRevealed(null);
    setRevealUrl(null);
  }, []);

  // Clear any revealed details on unmount so they never linger in memory.
  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const submitPin = useCallback(async () => {
    if (!card || !pinIntent || pin.length !== 6) return;
    setPinBusy(true);
    setPinError(null);
    try {
      if (pinIntent === "reveal") {
        const session = await api.revealCard(card.id, pin);
        setPinIntent(null);
        const isLocalStub = !session.revealUrl || session.revealUrl.includes("fake.local");
        if (session.mode === "plaintext" && session.pan) {
          // Real Rain reveal, server-side decrypted → show the actual PAN/CVC inline.
          setRevealed({
            number: session.pan.replace(/(.{4})(?=.)/g, "$1 ").trim(),
            cvc: session.cvc ?? "",
            exp:
              session.expiry ??
              `${String(card.expMonth).padStart(2, "0")}/${String(card.expYear).slice(-2)}`,
          });
        } else if (session.mode === "hosted_iframe" && session.revealUrl && !isLocalStub) {
          // Real Rain hosted reveal — embed it in-screen (not a new route).
          setRevealUrl(session.revealUrl);
        } else {
          // Sandbox/fake issuer: show a clearly-simulated full number inline.
          setRevealed({
            number: `4242 4242 4242 ${card.last4}`,
            cvc: ((Number(card.last4) % 900) + 100).toString(),
            exp: `${String(card.expMonth).padStart(2, "0")}/${String(card.expYear).slice(-2)}`,
          });
        }
        // Auto-hide after the session TTL so details don't stay on screen.
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(hideReveal, Math.max(5, session.ttlSec) * 1000);
      } else {
        await api.replaceCard(card.id, pin, replaceReason, newIdempotencyKey());
        setPinIntent(null);
        await load();
        Alert.alert("Card replaced", "Your old card was canceled and a new one issued.");
      }
    } catch (e) {
      setPinError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setPinBusy(false);
    }
  }, [card, pinIntent, pin, replaceReason, load, hideReveal]);

  const openReplaceSheet = () => {
    setReplaceReason("lost");
    setReplaceOpen(true);
  };
  const continueReplace = () => {
    setReplaceOpen(false);
    openPin("replace");
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
          <TabHeader title="Card" />
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
        <TabHeader title="Your card" />
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={[styles.card, frozen && styles.cardFrozen]}>
          <View style={styles.cardRow}>
            <Text style={styles.cardBrand}>{card.brand.toUpperCase()}</Text>
            <Text style={[styles.cardStatus, frozen && styles.cardStatusFrozen]}>
              {cardStatusLabel(card.status)}
            </Text>
          </View>
          <Text style={styles.cardNumber}>
            {revealed ? revealed.number : `•••• •••• •••• ${card.last4}`}
          </Text>
          <View style={styles.cardRow}>
            <Text style={styles.cardName}>{card.cardholderName}</Text>
            <View style={styles.cardMetaRight}>
              {revealed ? <Text style={styles.cardCvc}>CVC {revealed.cvc}</Text> : null}
              <Text style={styles.cardExp}>
                {String(card.expMonth).padStart(2, "0")}/{String(card.expYear).slice(-2)}
              </Text>
            </View>
          </View>
        </View>

        {revealed ? (
          <View style={styles.revealNote}>
            <Text style={styles.revealNoteText}>
              Showing your full card details. They'll hide automatically.
            </Text>
            <Pressable onPress={hideReveal} hitSlop={8}>
              <Text style={styles.revealHide}>Hide</Text>
            </Pressable>
          </View>
        ) : null}

        {revealUrl ? (
          <View style={styles.revealPanel}>
            <View style={styles.revealPanelHeader}>
              <Text style={styles.revealPanelTitle}>Card details</Text>
              <Pressable onPress={hideReveal} hitSlop={8}>
                <Text style={styles.revealHide}>Hide</Text>
              </Pressable>
            </View>
            <WebView source={{ uri: revealUrl }} style={styles.revealWeb} />
          </View>
        ) : null}

        {notActivated ? <Text style={styles.activateHint}>Turn on your card to start spending.</Text> : null}

        <View style={styles.actions}>
          {notActivated ? (
            <Button label="Activate card" onPress={openActivate} />
          ) : (
            <Button label={frozen ? "Unfreeze card" : "Freeze card"} variant="ghost" onPress={toggleFreeze} loading={busy} />
          )}
          {revealed || revealUrl ? (
            <Button label="Hide card details" variant="ghost" onPress={hideReveal} />
          ) : (
            <Button label="Reveal card details" variant="ghost" onPress={() => openPin("reveal")} disabled={!revealable} />
          )}
          <Button label="Report lost / replace" variant="ghost" onPress={openReplaceSheet} />
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

      <Modal visible={replaceOpen} transparent animationType="slide" onRequestClose={() => setReplaceOpen(false)}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Report lost / replace</Text>
            <Text style={styles.sheetBody}>
              We'll cancel this card and issue a new one. Your card number will change.
            </Text>
            <Text style={styles.reasonLabel}>Reason</Text>
            <View style={styles.reasonRow}>
              {REPLACE_REASONS.map((r) => {
                const active = r.value === replaceReason;
                return (
                  <Pressable
                    key={r.value}
                    onPress={() => setReplaceReason(r.value)}
                    style={[styles.reasonPill, active && styles.reasonPillActive]}
                  >
                    <Text style={[styles.reasonText, active && styles.reasonTextActive]}>{r.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Button label="Continue" onPress={continueReplace} />
            <Button label="Not now" variant="ghost" onPress={() => setReplaceOpen(false)} />
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
  cardMetaRight: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  cardCvc: { color: colors.inkFaint, fontSize: 14 },
  cardExp: { color: colors.inkFaint, fontSize: 14 },
  revealNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  revealNoteText: { flex: 1, color: colors.inkSoft, fontSize: 13 },
  revealHide: { color: colors.primary, fontSize: 14, fontWeight: "600" },
  revealPanel: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  revealPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
  },
  revealPanelTitle: { fontSize: 15, fontWeight: "600", color: colors.ink },
  revealWeb: { height: 220 },
  reasonLabel: { fontSize: 13, color: colors.inkSoft },
  reasonRow: { flexDirection: "row", gap: spacing.sm },
  reasonPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  reasonPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  reasonText: { fontSize: 14, color: colors.inkSoft },
  reasonTextActive: { color: colors.onPrimary },
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
