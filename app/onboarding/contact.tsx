import { useLoginWithEmail, useLoginWithSMS, usePrivy } from "@privy-io/expo";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { api, ApiError } from "@/lib/api";
import { stepToRoute } from "@/lib/onboarding";
import { devUserIdForEmail, isFakeAuth, setDevSession } from "@/lib/session";
import { colors, fonts, radius, spacing } from "@/lib/theme";

const E164 = /^\+[1-9]\d{7,14}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Method = "sms" | "email";

// Privy owns the OTP end-to-end (sends + verifies the code) for both channels;
// we then call BE signup with the resulting session token. Two methods are
// supported: phone+SMS is the eventual production path, email is kept on so the
// app is testable outside US/Canada (Privy SMS is US/Canada-only without an
// international-SMS grant). Both hooks are created unconditionally (rules of
// hooks); the active one drives the flow.
export default function Contact() {
  const router = useRouter();
  const { user } = usePrivy();
  const sms = useLoginWithSMS();
  const emailLogin = useLoginWithEmail();
  const [method, setMethod] = useState<Method>("email");

  // Already authenticated (e.g. persisted Privy session) — don't try to log in
  // again (Privy errors "already logged in"). Bounce to the entry gate, which
  // resumes the user at their correct onboarding step. FAKE mode ignores any
  // leftover Privy session (from an earlier real run) so it can't hijack the dev
  // bypass and loop signup back to Welcome.
  useEffect(() => {
    if (!isFakeAuth && user) router.replace("/");
  }, [user]);
  const [phase, setPhase] = useState<"input" | "code">("input");
  const [phone, setPhone] = useState("+1");
  // Dev bypass: prefill a dummy email + the fixed fake OTP so a test run needs
  // no real inbox/SMS. The BE FakeAuthAdapter accepts code `000000`.
  const [email, setEmail] = useState(isFakeAuth ? "dev@kinnectfi.test" : "");
  const [code, setCode] = useState(isFakeAuth ? "000000" : "");
  const [error, setError] = useState<string | null>(null);
  const [otpChallengeId, setOtpChallengeId] = useState<string | null>(null);
  const [devBusy, setDevBusy] = useState(false);

  const flow = method === "sms" ? sms : emailLogin;
  const busy =
    devBusy ||
    flow.state.status === "sending-code" ||
    flow.state.status === "submitting-code";
  const inputValid =
    method === "sms" ? E164.test(phone.trim()) : EMAIL.test(email.trim());
  const codeValid = /^\d{6}$/.test(code);
  const target = method === "sms" ? phone.trim() : email.trim();

  function switchMethod(next: Method) {
    if (next === method) return;
    setMethod(next);
    setPhase("input");
    setCode("");
    setError(null);
  }

  async function onSendCode() {
    setError(null);
    // Dev bypass: no real OTP send. Establish a `fake:<id>` session, then create
    // the user via signup so the BE issues a (always-`000000`) challenge.
    if (isFakeAuth) {
      setDevBusy(true);
      try {
        await setDevSession(devUserIdForEmail(email.trim()));
        const res = await api.signup({ email: email.trim(), deviceId: `${Platform.OS}-fake` });
        setOtpChallengeId(res.otpChallengeId ?? null);
        setPhase("code");
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Couldn't start the dev sign-in.");
      } finally {
        setDevBusy(false);
      }
      return;
    }
    try {
      if (method === "sms") await sms.sendCode({ phone: phone.trim() });
      else await emailLogin.sendCode({ email: email.trim() });
      setPhase("code");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the code. Try again.");
    }
  }

  async function onLogin() {
    setError(null);
    // Dev bypass: verify the BE-issued OTP directly (no Privy round trip).
    if (isFakeAuth) {
      if (!otpChallengeId) {
        setError("Send the code first.");
        return;
      }
      setDevBusy(true);
      try {
        const res = await api.verifyOtp(otpChallengeId, code);
        router.replace(stepToRoute(res.user.onboardingStep));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "That code didn't work. Try again.");
      } finally {
        setDevBusy(false);
      }
      return;
    }
    try {
      const user =
        method === "sms"
          ? await sms.loginWithCode({ code })
          : await emailLogin.loginWithCode({ code });
      if (!user) {
        setError("That code didn't work. Try again.");
        return;
      }
      // Authenticated: the Privy token is now available to the API client.
      const res = await api.signup(
        method === "sms"
          ? { phoneE164: phone.trim(), deviceId: `${Platform.OS}-privy` }
          : { email: email.trim(), deviceId: `${Platform.OS}-privy` },
      );
      router.replace(stepToRoute(res.user.onboardingStep));
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Something went wrong.",
      );
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.flex}>
          {phase === "input" ? (
            <>
              {isFakeAuth ? (
                <View style={styles.devBanner}>
                  <Text style={styles.devBannerText}>
                    DEV MODE — Privy bypassed. Sign in with any email; the code is 000000.
                  </Text>
                </View>
              ) : (
                <View style={styles.toggle}>
                  <Pressable
                    style={[styles.toggleBtn, method === "sms" && styles.toggleBtnActive]}
                    onPress={() => switchMethod("sms")}
                  >
                    <Text style={[styles.toggleText, method === "sms" && styles.toggleTextActive]}>
                      Phone
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.toggleBtn, method === "email" && styles.toggleBtnActive]}
                    onPress={() => switchMethod("email")}
                  >
                    <Text style={[styles.toggleText, method === "email" && styles.toggleTextActive]}>
                      Email
                    </Text>
                  </Pressable>
                </View>
              )}

              {method === "sms" && !isFakeAuth ? (
                <>
                  <Text style={styles.title}>What's your number?</Text>
                  <Text style={styles.sub}>
                    We'll text a code to confirm it's you. Standard rates may apply.
                  </Text>
                  <Text style={styles.label}>Mobile number</Text>
                  <TextInput
                    style={styles.input}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="+1 (415) 555-1234"
                    placeholderTextColor={colors.inkFaint}
                    keyboardType="phone-pad"
                    autoFocus
                  />
                </>
              ) : (
                <>
                  <Text style={styles.title}>What's your email?</Text>
                  <Text style={styles.sub}>We'll send a code to confirm it's you.</Text>
                  <Text style={styles.label}>Email address</Text>
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    placeholderTextColor={colors.inkFaint}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                  />
                </>
              )}
            </>
          ) : (
            <>
              <Text style={styles.title}>Enter the code.</Text>
              <Text style={styles.sub}>Sent to {target}. It expires shortly.</Text>
              <TextInput
                style={styles.codeInput}
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••••"
                placeholderTextColor={colors.inkFaint}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
            </>
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        {phase === "input" ? (
          <Button
            label="Send code"
            onPress={onSendCode}
            disabled={!inputValid || busy}
            loading={devBusy || flow.state.status === "sending-code"}
            style={{ marginBottom: spacing.md }}
          />
        ) : (
          <Button
            label="Verify"
            onPress={onLogin}
            disabled={!codeValid || busy}
            loading={devBusy || flow.state.status === "submitting-code"}
            style={{ marginBottom: spacing.md }}
          />
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  devBanner: {
    backgroundColor: colors.field,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.lg,
  },
  devBannerText: { fontSize: 12, color: colors.inkSoft, textAlign: "center" },
  toggle: {
    flexDirection: "row",
    backgroundColor: colors.field,
    borderRadius: radius.md,
    padding: 4,
    marginTop: spacing.lg,
  },
  toggleBtn: {
    flex: 1,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
  },
  toggleBtnActive: { backgroundColor: colors.bg },
  toggleText: { fontSize: 15, color: colors.inkSoft },
  toggleTextActive: { color: colors.ink, fontWeight: "600" },
  title: { fontFamily: fonts.serif, fontSize: 26, color: colors.ink, marginTop: spacing.lg },
  sub: { fontSize: 15, lineHeight: 22, color: colors.inkSoft, marginTop: spacing.sm },
  label: {
    fontSize: 13,
    color: colors.inkSoft,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.field,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 52,
    fontSize: 16,
    color: colors.ink,
  },
  codeInput: {
    backgroundColor: colors.field,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    height: 64,
    marginTop: spacing.xl,
    fontSize: 30,
    letterSpacing: 12,
    textAlign: "center",
    color: colors.ink,
  },
  error: { color: colors.danger, marginTop: spacing.md, fontSize: 14, textAlign: "center" },
});
