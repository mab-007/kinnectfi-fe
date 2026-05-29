import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { colors, fonts, spacing } from "@/lib/theme";

export default function Done() {
  const router = useRouter();
  const { step } = useLocalSearchParams<{ step?: string }>();

  // Enter the app as a fresh root: collapse the onboarding stack first so a
  // swipe-back from inside the app can't return to Welcome / onboarding screens.
  const goToApp = () => {
    if (router.canDismiss()) router.dismissAll();
    router.replace("/home");
  };

  return (
    <Screen>
      <View style={styles.body}>
        <View style={styles.check}>
          <Text style={styles.checkMark}>✓</Text>
        </View>
        <Text style={styles.title}>You're verified and ready.</Text>
        <Text style={styles.sub}>
          Identity confirmed and your account is active. Adding money, sending to
          family, and your card land as we build those next.
        </Text>
        <Text style={styles.badge}>onboarding step: {step ?? "complete"}</Text>
      </View>

      <View style={{ gap: spacing.xs, marginBottom: spacing.md }}>
        <Button label="Go to my account" onPress={goToApp} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.md },
  check: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: { color: colors.onPrimary, fontSize: 36, fontWeight: "700" },
  title: { fontFamily: fonts.serif, fontSize: 26, color: colors.ink, marginTop: spacing.md },
  sub: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.inkSoft,
    textAlign: "center",
    maxWidth: 320,
  },
  badge: {
    marginTop: spacing.sm,
    fontSize: 13,
    color: colors.inkFaint,
  },
});
