import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { api, ApiError, newIdempotencyKey } from "@/lib/api";
import { colors, fonts, radius, spacing } from "@/lib/theme";

type Stage = "issuing" | "done" | "error";

// KYC is already approved at onboarding, so issuance returns instantly (1a):
// this screen is a brief cosmetic transition, not a real async review.
const STEPS = [
  { key: "submitted", label: "Application submitted", sub: "Just now" },
  { key: "review", label: "Identity & address review", sub: "Verified" },
  { key: "issued", label: "Card issued", sub: "Apple Pay & Google Pay ready instantly" },
  { key: "shipped", label: "Physical card shipped", sub: "5–7 business days after approval" },
] as const;

export default function CardPending() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("issuing");
  const [error, setError] = useState<string | null>(null);
  const idemKey = useRef(newIdempotencyKey());
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const issue = useCallback(async () => {
    setStage("issuing");
    setError(null);
    try {
      await api.issueCard(idemKey.current);
      setStage("done");
      advanceTimer.current = setTimeout(() => router.dismissAll(), 1300);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "We couldn't issue your card. Try again.");
      setStage("error");
    }
  }, [router]);

  useEffect(() => {
    void issue();
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, [issue]);

  const ref = `KF-${idemKey.current.replace(/-/g, "").slice(0, 8).toUpperCase()}`;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.center}>
        <View style={styles.iconRing}>
          <Ionicons
            name={stage === "done" ? "checkmark" : "time-outline"}
            size={34}
            color={colors.primary}
          />
        </View>

        <Text style={styles.heading}>
          {stage === "done" ? "You're all set." : "Setting up your card."}
        </Text>
        <Text style={styles.sub}>
          {stage === "error"
            ? "Something went wrong while issuing your card."
            : stage === "done"
              ? "Your card is ready to use."
              : "This only takes a moment — hang tight."}
        </Text>

        <View style={styles.timeline}>
          {STEPS.map((step) => {
            const issuing = step.key === "issued" && stage === "issuing";
            const pending = step.key === "shipped" || (step.key === "issued" && stage === "error");
            const done = !issuing && !pending;
            return (
              <View key={step.key} style={styles.row}>
                <View style={styles.marker}>
                  {issuing ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : done ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  ) : (
                    <Ionicons name="ellipse-outline" size={20} color={colors.inkFaint} />
                  )}
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, pending && styles.rowLabelMuted]}>{step.label}</Text>
                  <Text style={styles.rowSub}>{step.sub}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.refBox}>
          <Text style={styles.refLabel}>REFERENCE</Text>
          <Text style={styles.refValue}>{ref}</Text>
        </View>
      </View>

      {stage === "error" ? (
        <View style={styles.footer}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="Try again" onPress={issue} />
          <Button label="Back" variant="ghost" onPress={() => router.dismissAll()} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, alignItems: "center", gap: spacing.md },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: colors.primaryDisabled,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  heading: { fontFamily: fonts.serif, fontSize: 26, color: colors.ink, textAlign: "center" },
  sub: { fontSize: 15, color: colors.inkSoft, textAlign: "center", lineHeight: 21, paddingHorizontal: spacing.md },
  timeline: { alignSelf: "stretch", backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, marginTop: spacing.lg },
  row: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  marker: { width: 22, alignItems: "center" },
  rowText: { flex: 1, gap: 1 },
  rowLabel: { fontSize: 15, fontWeight: "600", color: colors.ink },
  rowLabelMuted: { color: colors.inkFaint, fontWeight: "500" },
  rowSub: { fontSize: 13, color: colors.inkSoft },
  refBox: { alignSelf: "stretch", flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.md, paddingHorizontal: spacing.xs },
  refLabel: { fontSize: 12, color: colors.inkFaint, letterSpacing: 1 },
  refValue: { fontSize: 14, fontWeight: "700", color: colors.ink, letterSpacing: 1 },
  footer: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  error: { color: colors.danger, fontSize: 13, textAlign: "center" },
});
