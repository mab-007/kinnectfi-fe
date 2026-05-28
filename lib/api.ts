// Typed client for the Kinnectfi backend. Shapes mirror the BE zod contract
// (BE: src/routes/onboarding.ts). When the API stabilizes, switch to types
// generated from the OpenAPI doc at /docs instead of hand-maintaining these.
import { authHeader } from "./auth";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export interface OnboardingUser {
  id: string;
  status: string;
  onboardingStep: string;
  phoneE164: string | null;
  phoneVerifiedAt: string | null;
}

export interface SignupBody {
  // One of phoneE164 / email per the login method (SMS or email).
  phoneE164?: string;
  email?: string;
  deviceId?: string;
}

export interface SignupResponse {
  user: OnboardingUser;
  // Omitted in Privy mode — Privy verified the phone at login, so the user is
  // already at `otp_verified` and there's no BE-issued OTP to enter.
  otpChallengeId?: string;
  otpExpiresAt?: string;
}

export interface SetPinResponse {
  user: OnboardingUser;
}

export interface ProfileBody {
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
}

export interface OnboardingState {
  user: {
    id: string;
    status: string;
    onboardingStep: string;
    email: string | null;
    phoneE164: string | null;
    phoneVerifiedAt: string | null;
    emailVerifiedAt: string | null;
    legalFirstName: string | null;
    legalLastName: string | null;
    displayName: string | null;
    dateOfBirth: string | null;
    pinSet: boolean;
    biometricEnrolled: boolean;
  };
  tos: { accepted: boolean; acceptedVersion: string | null };
  legal: { version: string; termsUrl: string; privacyUrl: string };
}

export interface KycCompletionLink {
  url: string;
  params: Record<string, string>;
}

export interface KycState {
  onboardingStep: string;
  status: string;
  rainStatus: string | null;
  completionLink: KycCompletionLink | null;
  reason: string | null;
}

export interface KycAddress {
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  country: string;
}

export interface StartKycBody {
  ssn: string;
  email?: string;
  phoneCountryCode: string;
  phoneNumber: string;
  occupation: string;
  annualSalary: string;
  accountPurpose: string;
  expectedMonthlyVolume: string;
  iovationBlackbox: string;
  address: KycAddress;
}

// Non-crypto UUID v4. Good enough for an idempotency key (needs uniqueness, not
// secrecy) and avoids the RN `crypto.getRandomValues` polyfill footgun.
export function newIdempotencyKey(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface HealthResponse {
  status: "ok" | "degraded";
  checks: { db: boolean; redis: boolean; queue: boolean };
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus: number,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  opts: { method?: string; body?: unknown; auth?: boolean; idempotencyKey?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.auth) headers.authorization = await authHeader();
  if (opts.idempotencyKey) headers["idempotency-key"] = opts.idempotencyKey;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch (e) {
    throw new ApiError(
      "network_error",
      `Could not reach the backend at ${BASE_URL}. Is it running?`,
      0,
    );
  }

  const text = await res.text();
  const json = text ? JSON.parse(text) : {};

  if (!res.ok) {
    const err = json?.error ?? {};
    throw new ApiError(
      err.code ?? "unknown",
      err.message ?? `Request failed (${res.status})`,
      res.status,
      err.requestId,
    );
  }
  return json as T;
}

export const api = {
  health: () => request<HealthResponse>("/health"),

  signup: (body: SignupBody) =>
    request<SignupResponse>("/v1/onboarding/signup", {
      method: "POST",
      body,
      auth: true,
    }),

  setPin: (pin: string, idempotencyKey: string) =>
    request<SetPinResponse>("/v1/onboarding/set-pin", {
      method: "POST",
      body: { pin },
      auth: true,
      idempotencyKey,
    }),

  saveProfile: (body: ProfileBody, idempotencyKey: string) =>
    request<SetPinResponse>("/v1/onboarding/profile", {
      method: "POST",
      body,
      auth: true,
      idempotencyKey,
    }),

  acceptTos: (tosVersion: string, idempotencyKey: string) =>
    request<SetPinResponse>("/v1/onboarding/accept-tos", {
      method: "POST",
      body: { tosVersion },
      auth: true,
      idempotencyKey,
    }),

  enrollBiometric: (deviceId: string, idempotencyKey: string) =>
    request<SetPinResponse>("/v1/onboarding/biometric", {
      method: "POST",
      body: { deviceId },
      auth: true,
      idempotencyKey,
    }),

  getState: () => request<OnboardingState>("/v1/onboarding/state", { auth: true }),

  startKyc: (body: StartKycBody, idempotencyKey: string) =>
    request<KycState>("/v1/onboarding/kyc/start", {
      method: "POST",
      body,
      auth: true,
      idempotencyKey,
    }),

  refreshKyc: () =>
    request<KycState>("/v1/onboarding/kyc/refresh", { method: "POST", auth: true }),

  getKycState: () => request<KycState>("/v1/onboarding/kyc/state", { auth: true }),
};
