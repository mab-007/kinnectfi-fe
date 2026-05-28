import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { colors, fonts, spacing } from "@/lib/theme";

export default function Welcome() {
  const router = useRouter();

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.wordmark}>kinnectfi</Text>
        <Text style={styles.headline}>The financial home for Filipinos abroad.</Text>
        <Text style={styles.sub}>
          Free remittance. Real banking. Built for the way you support family.
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.legal}>
          By continuing you agree to our Terms & Privacy Notice.
        </Text>
        <Button label="Get started" onPress={() => router.push("/onboarding/contact")} />
        <Button
          label="I already have an account"
          variant="ghost"
          onPress={() => router.push("/onboarding/contact")}
          style={{ marginTop: spacing.xs }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.md },
  wordmark: { fontFamily: fonts.serif, fontSize: 40, color: colors.ink, marginBottom: spacing.xl },
  headline: {
    fontFamily: fonts.serif,
    fontSize: 26,
    lineHeight: 34,
    color: colors.ink,
    textAlign: "center",
  },
  sub: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.inkSoft,
    textAlign: "center",
    marginTop: spacing.md,
    maxWidth: 300,
  },
  footer: { gap: spacing.sm, paddingBottom: spacing.md },
  legal: {
    fontSize: 12,
    color: colors.inkFaint,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
});
