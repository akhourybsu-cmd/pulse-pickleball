import type { VenueWaiverSummary } from "@/lib/venues/customerRecords";
export function VenueWaiverStatus({ waiver }: { waiver?: VenueWaiverSummary }) {
  if (!waiver) return null;
  const text = {
    not_required: "No required waiver",
    signed: "Waiver signed",
    update_required: "Updated waiver required",
    not_signed: "Waiver not signed",
  }[waiver.status];
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${waiver.missing > 0 ? "border-amber-400/50 bg-amber-500/10 text-amber-800 dark:text-amber-200" : "border-emerald-400/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"}`}
    >
      {text}
    </span>
  );
}
