import { useRouter } from "expo-router";
import { useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { colors, fonts, radius, spacing } from "@/lib/theme";

interface Benefit {
  value: string;
  unit: string;
  accent?: boolean;
  title: string;
  body: string;
}

const BENEFITS: Benefit[] = [
  {
    value: "4%",
    unit: "APY",
    accent: true,
    title: "Earn 4% yield on your savings.",
    body: "Spend $400 or more in a month and your KinnectFi balance earns 4% APY — automatically.",
  },
  {
    value: "1%",
    unit: "cashback",
    title: "1% cashback in the US, 0.5% everywhere else.",
    body: "Cashback lands in your KinnectFi wallet within 24 hours.",
  },
  {
    value: "3",
    unit: "min",
    title: "Ready to spend in minutes.",
    body: "Get approved, add the card to Apple Pay or Google Pay, and tap to pay anywhere contactless is accepted. No waiting on the mail.",
  },
];

export default function CardBenefits() {
  const router = useRouter();
  // Guard against a double-tap pushing two card-pending screens (→ two issue
  // calls with different idempotency keys). One navigation per mount.
  const navigating = useRef(false);
  const getCard = () => {
    if (navigating.current) return;
    navigating.current = true;
    router.push("/card-pending");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Card benefits</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>WHY THE KINNECTFI CARD</Text>
        <Text style={styles.heading}>Earn more, spend smarter, and bring family along.</Text>

        {BENEFITS.map((b) => (
          <View key={b.title} style={styles.card}>
            <Text style={styles.cardValue}>
              <Text style={[styles.cardValueNum, b.accent && styles.cardValueAccent]}>{b.value}</Text>
              <Text style={styles.cardValueUnit}> {b.unit}</Text>
            </Text>
            <Text style={styles.cardTitle}>{b.title}</Text>
            <Text style={styles.cardBody}>{b.body}</Text>
          </View>
        ))}

        <View style={styles.familyCard}>
          <Text style={styles.eyebrow}>FOR YOUR FAMILY</Text>
          <Text style={styles.familyTitle}>Your family back home, on the same card.</Text>
          <Text style={styles.cardBody}>
            Send money to loved ones in the Philippines in seconds and share spending access — all
            from one account.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Get my card" onPress={getCard} />
        <Text style={styles.disclaimer}>
          KinnectFi Visa debit card is issued by Rain. Subject to approval and applicable terms.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  back: { color: colors.primary, fontSize: 16, width: 48 },
  title: { fontFamily: fonts.serif, fontSize: 20, color: colors.ink },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  heading: { fontFamily: fonts.serif, fontSize: 28, color: colors.ink, lineHeight: 34, marginBottom: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs },
  cardValue: { marginBottom: spacing.xs },
  cardValueNum: { fontSize: 34, fontWeight: "800", color: colors.ink },
  cardValueAccent: { color: colors.success },
  cardValueUnit: { fontSize: 14, color: colors.inkSoft, fontWeight: "600" },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
  cardBody: { fontSize: 14, color: colors.inkSoft, lineHeight: 20 },
  familyCard: { backgroundColor: "#EFE7D7", borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs },
  familyTitle: { fontFamily: fonts.serif, fontSize: 22, color: colors.ink, lineHeight: 28, marginVertical: spacing.xs },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm, borderTopWidth: 1, borderColor: colors.border },
  disclaimer: { color: colors.inkFaint, fontSize: 12, lineHeight: 17, textAlign: "center" },
});
