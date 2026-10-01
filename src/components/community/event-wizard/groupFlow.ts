import type { EventWizardFormData, EventWizardStep } from "./types";

export const GROUP_EVENT_STEPS: EventWizardStep[] = [
  { id: "basics", label: "Basics" },
  { id: "datetime", label: "Schedule" },
  { id: "details", label: "Players" },
  { id: "review", label: "Review" },
];

/** Validate earlier sections again when jumping forward or publishing. */
export function groupEventStepError(
  step: string,
  data: EventWizardFormData
): string | null {
  if (step === "basics") {
    if (!data.eventType) return "Choose an event format to continue.";
    if (!data.title.trim()) return "Give your event a name to continue.";
  }
  if (step === "datetime") {
    if (!data.date || !data.startTime)
      return "Choose a date and start time to continue.";
    const start = new Date(`${data.date}T${data.startTime}`);
    if (!Number.isFinite(start.getTime()))
      return "Enter a valid date and start time.";
    if (data.endTime && data.endTime <= data.startTime)
      return "End time must be later than the start time.";
  }
  if (step === "details") {
    const positive = (value: number | null, max = Infinity) =>
      value == null || (Number.isInteger(value) && value >= 1 && value <= max);
    if (!positive(data.capacity))
      return "Capacity must be at least 1 player, or leave it empty for unlimited spots.";
    if (data.capacity && data.waitlistEnabled && !positive(data.waitlistLimit))
      return "Waitlist capacity must be at least 1, or leave it empty for unlimited spots.";
    if (
      data.eventType === "round_robin" &&
      (!positive(data.rrCourts, 20) || !positive(data.rrGamesPerPlayer, 20))
    )
      return "Courts and games per player must be between 1 and 20, or left empty.";
  }
  return null;
}

export function canVisitGroupEventStep(
  next: number,
  furthest: number,
  data: EventWizardFormData
): boolean {
  return (
    next >= 0 &&
    next < GROUP_EVENT_STEPS.length &&
    next <= furthest &&
    GROUP_EVENT_STEPS.slice(0, next).every(
      (step) => !groupEventStepError(step.id, data)
    )
  );
}
