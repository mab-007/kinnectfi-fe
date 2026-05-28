import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { colors, fonts, spacing } from "@/lib/theme";

// Hosts Rain's hosted Sumsub flow (ID doc + selfie). We open
// completionLink.url with its params as query params; when the user is done they
// tap Continue, which hands off to the status screen that polls for approval.
export default function KycVerify() {
  const router = useRouter();
  const { url, params } = useLocalSearchParams<{ url?: string; params?: string }>();
  const [loading, setLoading] = useState(true);

  const fullUrl = useMemo(() => {
    if (!url) return null;
    let qs = "";
    try {
      const parsed = JSON.parse(params ?? "{}") as Record<string, string>;
      qs = Object.entries(parsed)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&");
    } catch {
      qs = "";
    }
    return qs ? `${url}?${qs}` : url;
  }, [url, params]);

  if (!fullUrl) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.title}>Verification link missing.</Text>
          <Button
            label="Back"
            variant="ghost"
            onPress={() => router.replace("/onboarding/kyc")}
            style={{ marginTop: spacing.md }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.flex}>
        <WebView
          source={{ uri: fullUrl }}
          onLoadEnd={() => setLoading(false)}
          style={styles.web}
          originWhitelist={["*"]}
        />
        {loading ? (
          <View style={styles.overlay}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}
      </View>
      <Button
        label="I've finished verification"
        onPress={() => router.replace("/onboarding/kyc-status")}
        style={{ marginVertical: spacing.md }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  web: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontFamily: fonts.serif, fontSize: 22, color: colors.ink },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
});
