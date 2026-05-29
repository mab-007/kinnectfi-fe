import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { colors, fonts, spacing } from "@/lib/theme";

// Hosts Rain's single-use PCI reveal page (PAN/CVC). The URL is short-lived
// (≤60s) and single-use — we never store or log it (BE keeps metadata only).
export default function CardReveal() {
  const router = useRouter();
  const { url } = useLocalSearchParams<{ url?: string }>();
  const [loading, setLoading] = useState(true);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>Done</Text>
        </Pressable>
        <Text style={styles.title}>Card details</Text>
        <View style={{ width: 48 }} />
      </View>
      {url ? (
        <View style={styles.webWrap}>
          <WebView source={{ uri: url }} onLoadEnd={() => setLoading(false)} />
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.center}>
          <Text style={styles.muted}>Reveal session expired. Try again.</Text>
        </View>
      )}
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
  back: { color: colors.primary, fontSize: 16 },
  title: { fontFamily: fonts.serif, fontSize: 20, color: colors.ink },
  webWrap: { flex: 1 },
  center: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center" },
  muted: { color: colors.inkSoft, fontSize: 14 },
});
