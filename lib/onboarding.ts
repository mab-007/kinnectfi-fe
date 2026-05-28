// Map the backend onboarding step to the screen that should handle it next, so a
// returning/already-authenticated user resumes in the right place.
//
// Biometric enrollment is intentionally absent here: it's optional + non-gating,
// so it has no step of its own and is offered once inline after ToS (tos.tsx →
// /onboarding/biometric → done). Resume sends a tos_accepted user straight to
// done rather than re-nagging the prompt on every launch.
export function stepToRoute(step: string): string {
  switch (step) {
    case "pin_set":
      return "/onboarding/name";
    case "name_captured":
      return "/onboarding/tos";
    case "tos_accepted":
    case "kyc_submitted":
    case "kyc_approved":
    case "provisioning":
    case "complete":
      return "/onboarding/done";
    default: // signup_started / otp_verified
      return "/onboarding/pin";
  }
}
