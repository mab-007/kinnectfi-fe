import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type ViewStyle,
} from "react-native";
import { colors, radius, spacing } from "@/lib/theme";

interface Props {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  style,
}: Props) {
  const isPrimary = variant === "primary";
  const blocked = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={blocked}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.ghost,
        isPrimary && pressed && !blocked ? styles.primaryPressed : null,
        isPrimary && blocked ? styles.primaryDisabled : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.onPrimary : colors.primary} />
      ) : (
        <Text style={[styles.label, isPrimary ? styles.labelPrimary : styles.labelGhost]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 54,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  primary: { backgroundColor: colors.primary },
  primaryPressed: { backgroundColor: colors.primaryPressed },
  primaryDisabled: { backgroundColor: colors.primaryDisabled },
  ghost: { backgroundColor: "transparent" },
  label: { fontSize: 16, fontWeight: "600" },
  labelPrimary: { color: colors.onPrimary },
  labelGhost: { color: colors.primary },
});
