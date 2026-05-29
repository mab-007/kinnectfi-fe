import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts, spacing } from "@/lib/theme";

export default function Send() {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.body}>
        <Text style={styles.title}>Send</Text>
        <View style={styles.center}>
          <Ionicons name="paper-plane-outline" size={48} color={colors.inkFaint} />
          <Text style={styles.headline}>Send money home — soon.</Text>
          <Text style={styles.sub}>
            Free transfers to GCash, Maya, and bank accounts in the Philippines. We're wiring up the
            payout rails.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  title: { fontFamily: fonts.serif, fontSize: 26, color: colors.ink },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.md, paddingBottom: spacing.xxl },
  headline: { fontFamily: fonts.serif, fontSize: 22, color: colors.ink },
  sub: { fontSize: 14, color: colors.inkSoft, textAlign: "center", lineHeight: 21, maxWidth: 300 },
});
