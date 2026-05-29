import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "@/lib/api";
import { initialsOf } from "@/lib/format";
import { colors, fonts, spacing } from "@/lib/theme";

// Cache initials across tabs so each L0 page doesn't re-fetch state just to draw
// the avatar. Cleared implicitly on app restart (module reload).
let cachedInitials: string | null = null;

// The account avatar shown on every L0 (tab) page. Tapping it opens the account
// menu (Profile / Help / Log out) — the old "More" tab content.
export function AccountAvatar() {
  const router = useRouter();
  const [initials, setInitials] = useState<string>(cachedInitials ?? "");

  useEffect(() => {
    if (cachedInitials) return;
    let active = true;
    api
      .getState()
      .then((s) => {
        const v = initialsOf(s.user.legalFirstName, s.user.legalLastName);
        cachedInitials = v;
        if (active) setInitials(v);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return (
    <Pressable style={styles.avatar} onPress={() => router.push("/menu")} hitSlop={8}>
      <Text style={styles.avatarText}>{initials || "?"}</Text>
    </Pressable>
  );
}

// Standard L0 header: a serif page title on the left, the account avatar on the right.
export function TabHeader({ title }: { title: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      <AccountAvatar />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontFamily: fonts.serif, fontSize: 26, color: colors.ink },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 14, fontWeight: "700", color: colors.inkSoft },
});
