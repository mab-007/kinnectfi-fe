import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { colors } from "@/lib/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
const icon =
  (name: IconName) =>
  ({ color, size }: { color: string; size: number }) =>
    <Ionicons name={name} color={color} size={size} />;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: icon("home-outline") }} />
      <Tabs.Screen name="send" options={{ title: "Send", tabBarIcon: icon("paper-plane-outline") }} />
      <Tabs.Screen name="card" options={{ title: "Card", tabBarIcon: icon("card-outline") }} />
      <Tabs.Screen name="save" options={{ title: "Save", tabBarIcon: icon("trending-up-outline") }} />
      <Tabs.Screen name="activity" options={{ title: "Activity", tabBarIcon: icon("time-outline") }} />
    </Tabs>
  );
}
