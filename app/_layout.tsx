import { PrivyProvider, usePrivy } from "@privy-io/expo";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { registerTokenGetter } from "@/lib/privy";
import { colors } from "@/lib/theme";

const PRIVY_APP_ID = process.env.EXPO_PUBLIC_PRIVY_APP_ID ?? "";
const PRIVY_CLIENT_ID = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID ?? "";

// Wire Privy's token getter into the plain API client once, inside the provider.
function TokenBridge() {
  const { getAccessToken } = usePrivy();
  useEffect(() => {
    registerTokenGetter(getAccessToken);
  }, [getAccessToken]);
  return null;
}

// Hold rendering until the Privy SDK has initialized (restoring any session).
function Gate({ children }: { children: React.ReactNode }) {
  const { isReady } = usePrivy();
  if (!isReady) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      clientId={PRIVY_CLIENT_ID}
      config={{ embedded: { ethereum: { createOnLogin: "off" } } }}
    >
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <TokenBridge />
        <Gate>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
              animation: "slide_from_right",
            }}
          />
        </Gate>
      </SafeAreaProvider>
    </PrivyProvider>
  );
}
