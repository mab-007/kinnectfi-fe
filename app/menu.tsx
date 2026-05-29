import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "@/lib/session";
import { colors, fonts, radius, spacing } from "@/lib/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

export default function Menu() {
  const router = useRouter();
  const { logout } = useSession();

  const confirmLogout = () => {
    Alert.alert("Log out?", "You'll need to sign in again to access your account.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/");
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Account</Text>
        <View style={{ width: 48 }} />
      </View>

      <View style={styles.body}>
        <View style={styles.group}>
          <Row icon="person-circle-outline" label="Profile" onPress={() => router.push("/profile")} />
          <Row
            icon="help-circle-outline"
            label="Help & support"
            onPress={() => Alert.alert("Help", "Support is coming soon.")}
          />
        </View>
        <View style={styles.group}>
          <Row icon="log-out-outline" label="Log out" danger onPress={confirmLogout} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function Row({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Ionicons name={icon} size={22} color={danger ? colors.danger : colors.inkSoft} />
      <Text style={[styles.rowLabel, danger && { color: colors.danger }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />
    </Pressable>
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
  headerTitle: { fontFamily: fonts.serif, fontSize: 20, color: colors.ink },
  body: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.lg },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: { flex: 1, fontSize: 16, color: colors.ink },
});
