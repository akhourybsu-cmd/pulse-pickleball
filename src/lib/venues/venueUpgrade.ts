import type { PaymentConfig } from "@/lib/payments";

export function venueUpgradeState({
  isOwner,
  verified,
  config,
  pending = false,
  error = false,
}: {
  isOwner: boolean;
  verified: boolean;
  config?: PaymentConfig;
  pending?: boolean;
  error?: boolean;
}) {
  if (!isOwner)
    return {
      ready: false,
      label: "Venue owner required",
      message:
        "Only the current venue owner can verify ownership and start a subscription. Managers can review the features and pricing here.",
    };
  if (!verified)
    return {
      ready: false,
      label: "Verify ownership first",
      message:
        "Submit ownership evidence for PULSE review before purchasing. Verification is free and does not start a subscription.",
    };
  if (pending)
    return {
      ready: false,
      label: "Checking checkout…",
      message:
        "Checking secure checkout availability. No payment has been taken.",
    };
  if (error)
    return {
      ready: false,
      label: "Checkout unavailable",
      message:
        "We could not check payment availability. Retry before continuing; no payment has been taken.",
    };
  if (
    config?.cadence === "monthly" &&
    (config.mode === "live" || config.mode === "test")
  )
    return {
      ready: true,
      label:
        config.mode === "test"
          ? "Test checkout · $10/month"
          : "Continue · $10/month",
      message:
        config.mode === "test"
          ? "Test checkout only. No money moves and no real feature is activated."
          : "Complete secure Stripe checkout. This feature unlocks after your payment is confirmed.",
    };
  return {
    ready: false,
    label: "Checkout coming soon",
    message:
      "PULSE is completing payment setup. You can review upgrades now, but subscriptions cannot be purchased yet. Your free community stays available.",
  };
}
