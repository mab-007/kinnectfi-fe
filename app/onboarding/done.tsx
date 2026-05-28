import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { colors, fonts, spacing } from "@/lib/theme";

export default function Done() {
  const router = useRouter();
  const { step } = useLocalSearchParams<{ step?: string }>();

  return (
    <Screen>
      <View style={styles.body}>
        <View style={styles.check}>
          <Text style={styles.checkMark}>✓</Text>
        </View>
        <Text style={styles.title}>Number verified.</Text>
        <Text style={styles.sub}>
          You're past the front door. The rest of onboarding — PIN, name, ID
          check, address — lands as we build those backend steps.
        </Text>
        <Text style={styles.badge}>onboarding step: {step ?? "otp_verified"}</Text>
      </View>

      <Button
        label="Start over"
        variant="ghost"
        onPress={() => router.replace("/")}
        style={{ marginBottom: spacing.md }}
      />
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
