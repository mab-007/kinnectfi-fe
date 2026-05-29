import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { api, ApiError, type OnboardingState } from "@/lib/api";
import { initialsOf } from "@/lib/format";
import { useSession } from "@/lib/session";
import { colors, fonts, radius, spacing } from "@/lib/theme";

export default function Profile() {
  const router = useRouter();
  const { logout } = useSession();
  const [state, setState] = useState<OnboardingState["user"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getState()
      .then((s) => setState(s.user))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't load your profile."))
      .finally(() => setLoading(false));
  }, []);

  const onLogout = async () => {
    await logout();
    router.replace("/");
  };

  const fullName = [state?.legalFirstName, state?.legalLastName].filter(Boolean).join(" ") || state?.displayName || "—";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 48 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <View style={styles.body}>
          <View style={styles.hero}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initialsOf(state?.legalFirstName, state?.legalLastName)}</Text>
            </View>
            <Text style={styles.name}>{fullName}</Text>
            {state?.status ? (
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{state.status}</Text>
              </View>
            ) : null}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.group}>
            <Field label="Email" value={state?.email ?? "—"} />
            <Field label="Phone" value={state?.phoneE164 ?? "—"} />
            <Field label="PIN" value={state?.pinSet ? "Set" : "Not set"} />
            <Field label="Biometric" value={state?.biometricEnrolled ? "Enabled" : "Off"} last />
          </View>

          <View style={{ flex: 1 }} />
          <Button label="Log out" variant="ghost" onPress={onLogout} />
        </View>
      )}
    </SafeAreaView>
  );
}

function Field({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.field, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  back: { color: colors.primary, fontSize: 16, width: 48 },
  headerTitle: { fontFamily: fonts.serif, fontSize: 20, color: colors.ink },
  body: { flex: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.lg },
  hero: { alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 28, fontWeight: "700", color: colors.inkSoft },
  name: { fontFamily: fonts.serif, fontSize: 24, color: colors.ink },
  statusBadge: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  statusText: { fontSize: 12, color: colors.inkSoft, textTransform: "capitalize" },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  field: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  fieldLabel: { fontSize: 14, color: colors.inkSoft },
  fieldValue: { fontSize: 14, color: colors.ink, fontWeight: "500" },
  error: { color: colors.danger, fontSize: 13, textAlign: "center" },
});
