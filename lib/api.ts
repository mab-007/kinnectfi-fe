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
  walletAddress: string;
  phoneE164: string;
  email?: string;
  deviceId?: string;
}

export interface SignupResponse {
  user: OnboardingUser;
  otpChallengeId: string;
  otpExpiresAt: string;
}

export interface VerifyOtpResponse {
  user: OnboardingUser;
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
  opts: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.auth) headers.authorization = await authHeader();

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

  verifyOtp: (otpChallengeId: string, code: string) =>
    request<VerifyOtpResponse>("/v1/onboarding/verify-otp", {
      method: "POST",
      body: { otpChallengeId, code },
      auth: true,
    }),
};
