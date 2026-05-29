import { PrivyProvider, usePrivy } from "@privy-io/expo";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useSyncExternalStore } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LockGate } from "@/components/LockGate";
import { appLockSnapshot, isAppLockReady, loadAppLock, subscribeAppLock } from "@/lib/applock";
import { registerTokenGetter } from "@/lib/privy";
import { bootDevSession, useSession } from "@/lib/session";
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

// Hold rendering until the session is ready (Privy SDK init, or the dev-session
// restore in fake mode) so screens don't flash before we know the auth state.
function Gate({ children }: { children: React.ReactNode }) {
  const { isReady } = useSession();
  useSyncExternalStore(subscribeAppLock, appLockSnapshot, appLockSnapshot);
  if (!isReady || !isAppLockReady()) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  return <LockGate>{children}</LockGate>;
}

export default function RootLayout() {
  // Restore the dev session (fake mode) + app-lock flag once on boot.
  useEffect(() => {
    void bootDevSession();
    void loadAppLock();
  }, []);

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
