import { useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Button } from "@/components/Button";
import { colors, fonts, radius, spacing } from "@/lib/theme";

// Hosts Rain's hosted Sumsub flow (ID doc + selfie). We open completionLink.url
// with its params as query params. Camera access is requested up front (Sumsub
// needs it for the ID scan + liveness selfie); WKWebView denies capture unless we
// both hold the OS permission and tell the WebView to grant it to the page.
export default function KycVerify() {
  const router = useRouter();
  const { url, params } = useLocalSearchParams<{ url?: string; params?: string }>();
  const [loading, setLoading] = useState(true);
  const [permission, requestPermission] = useCameraPermissions();

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
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.center}>
          <Text style={styles.title}>Verification link missing.</Text>
          <Button
            label="Back"
            variant="ghost"
            onPress={() => router.replace("/onboarding/kyc")}
            style={{ marginTop: spacing.md }}
          />
        </View>
      </SafeAreaView>
    );
  }

  // Ask for the camera before Sumsub starts, so the in-flow capture never dead-ends.
  if (!permission?.granted) {
    const blocked = permission?.canAskAgain === false;
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.center}>
          <View style={styles.gateIcon}>
            <Text style={styles.gateGlyph}>◉</Text>
          </View>
          <Text style={styles.title}>Camera access</Text>
          <Text style={styles.gateBody}>
            Identity verification needs your camera to scan your ID and take a quick
            selfie. Your photos go straight to our verification partner.
          </Text>
          <Button
            label={blocked ? "Open Settings" : "Allow camera"}
            onPress={() => (blocked ? Linking.openSettings() : requestPermission())}
            style={{ marginTop: spacing.lg, alignSelf: "stretch" }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Identity verification</Text>
      </View>
      <View style={styles.flex}>
        <WebView
          source={{ uri: fullUrl }}
          onLoadEnd={() => setLoading(false)}
          style={styles.web}
          originWhitelist={["*"]}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mediaCapturePermissionGrantType="grant"
          allowsProtectedMedia
        />
        {loading ? (
          <View style={styles.overlay}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}
      </View>
      <View style={styles.footer}>
        <Button
          label="I've finished verification"
          onPress={() => router.replace("/onboarding/kyc-status")}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  web: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontFamily: fonts.serif, fontSize: 20, color: colors.ink },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 24,
    color: colors.ink,
    textAlign: "center",
  },
  gateIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  gateGlyph: { fontSize: 28, color: colors.primary },
  gateBody: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.inkSoft,
    textAlign: "center",
    marginTop: spacing.sm,
    maxWidth: 320,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
});
