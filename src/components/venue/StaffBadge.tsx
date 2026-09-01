import { BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStaffBadge, useVenueStaffAccent } from './VenueStaffContext';

/**
 * Marks a message or post as coming from the venue.
 *
 * Deliberately loud. A member needs to know at a glance that "courts are closed
 * tomorrow" came from the front desk and not from another player guessing — so
 * this is a filled chip rather than the outline badges used elsewhere, and it
 * carries a check mark so it reads as authority even at a glance or in
 * greyscale.
 *
 * Renders nothing outside a venue, or for a member who isn't staff, so shared
 * community components can drop it in unconditionally.
 */
export function StaffBadge({
  userId,
  className,
}: {
  userId: string | null | undefined;
  className?: string;
}) {
  const badge = useStaffBadge(userId);
  const accent = useVenueStaffAccent();

  if (!badge) return null;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary px-1.5 py-[1px]',
        'text-[9px] font-bold uppercase tracking-[0.08em] text-primary-foreground',
        className,
      )}
      style={accent ? { backgroundColor: accent, color: '#fff' } : undefined}
      title={`${badge.label} at this venue`}
    >
      <BadgeCheck className="h-2.5 w-2.5" aria-hidden />
      {badge.label}
    </span>
  );
}

/**
 * A tint for the whole message bubble or post card when the author is staff.
 *
 * The badge alone is easy to miss while scrolling a busy feed; a ring around
 * the thing itself is what makes staff posts findable rather than merely
 * labelled.
 */
export function useStaffEmphasis(userId: string | null | undefined): {
  isStaff: boolean;
  ringStyle: React.CSSProperties | undefined;
} {
  const badge = useStaffBadge(userId);
  const accent = useVenueStaffAccent();

  return {
    isStaff: !!badge,
    ringStyle: badge && accent ? { borderColor: `${accent}66` } : undefined,
  };
}
