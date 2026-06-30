import { useNavigate } from 'react-router-dom';
import { Users, Lock, Globe, Eye, Crown, Shield, ChevronRight, BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import type { GroupWithMembership } from '@/hooks/useGroups';

interface ReorderableGroupListProps {
  groups: GroupWithMembership[];
  /**
   * No-op since drag-to-reorder was removed for a cleaner mobile list.
   * Prop kept on the API so callers (Community.tsx) don't need to know
   * about the rewrite. Pass anything — it's ignored.
   */
  onReorder?: (groups: GroupWithMembership[]) => void;
}

const typeLabels: Record<string, string> = {
  crew: 'Crew',
  league: 'League',
  open_play: 'Open Play',
  venue_official: 'Venue Official',
  tournament: 'Tournament',
};

// Avatar fallback gradients — soft, brand-aligned. Replaced the prior
// per-type pill colors (blue/amber/green/purple/red) which read busy
// and off-brand against the gold + ink palette.
const avatarGradients = [
  'bg-gradient-to-br from-primary/30 to-primary/10 text-primary',
  'bg-gradient-to-br from-amber-400/30 to-amber-500/10 text-amber-700 dark:text-amber-300',
  'bg-gradient-to-br from-emerald-400/25 to-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  'bg-gradient-to-br from-sky-400/25 to-sky-500/10 text-sky-700 dark:text-sky-300',
  'bg-gradient-to-br from-rose-400/25 to-rose-500/10 text-rose-700 dark:text-rose-300',
  'bg-gradient-to-br from-violet-400/25 to-violet-500/10 text-violet-700 dark:text-violet-300',
];

function GroupRow({ group }: { group: GroupWithMembership }) {
  const navigate = useNavigate();

  const roleIcon =
    group.membership?.role === 'owner' ? <Crown className="h-3 w-3" />
    : group.membership?.role === 'moderator' ? <Shield className="h-3 w-3" />
    : null;
  const roleLabel =
    group.membership?.role === 'owner' ? 'Owner'
    : group.membership?.role === 'moderator' ? 'Mod'
    : null; // plain members don't get a label — reduces visual noise

  const visibilityIcon =
    group.visibility === 'private' ? <Lock className="h-3 w-3" />
    : group.visibility === 'unlisted' ? <Eye className="h-3 w-3" />
    : <Globe className="h-3 w-3" />;

  const isVerifiedVenue = group.type === 'venue_official' && group.is_venue_verified;
  const initials = group.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const colorIndex = group.name.charCodeAt(0) % avatarGradients.length;

  return (
    <Card
      className={cn(
        'cursor-pointer border-border/40 transition-all duration-200',
        // Premium-feeling hover: soft primary tint + subtle lift, no
        // visual jump on press.
        'hover:border-primary/30 hover:bg-gradient-to-br hover:from-primary/[0.03] hover:to-transparent',
        'active:scale-[0.995]',
      )}
      onClick={() => navigate(`/player/community/group/${group.id}`)}
    >
      <div className="p-4 flex items-center gap-3">
        {/* Avatar — soft gradient swatch when no icon. Subtle ring on
            verified venues for status without yet another pill. */}
        <div
          className={cn(
            'h-12 w-12 rounded-xl flex items-center justify-center text-base font-semibold shrink-0 ring-1 ring-border/40',
            isVerifiedVenue && 'ring-amber-400/40',
            group.icon_url ? '' : avatarGradients[colorIndex],
          )}
          style={
            group.icon_url
              ? { backgroundImage: `url(${group.icon_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : undefined
          }
        >
          {!group.icon_url && initials}
        </div>

        {/* Content — title row + one tight metadata line. The role +
            type + members + visibility used to render as four separate
            chips that wrapped to 2-3 lines on mobile; now it's a
            single inline strip with subtle dot separators. */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="font-semibold text-sm text-foreground truncate">{group.name}</h3>
            {isVerifiedVenue && (
              <BadgeCheck className="h-3.5 w-3.5 text-amber-500 shrink-0" aria-label="Official venue group" />
            )}
          </div>

          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground truncate">
            {roleLabel && (
              <>
                <span className="inline-flex items-center gap-1 text-foreground/80">
                  {roleIcon}
                  {roleLabel}
                </span>
                <span className="opacity-40">·</span>
              </>
            )}
            <span className="truncate">{typeLabels[group.type]}</span>
            <span className="opacity-40">·</span>
            <span className="inline-flex items-center gap-1 shrink-0">
              <Users className="h-3 w-3" />
              {group.member_count}
            </span>
            <span className="opacity-40">·</span>
            <span className="inline-flex items-center text-muted-foreground/70 shrink-0">
              {visibilityIcon}
            </span>
          </div>
        </div>

        {/* Right side — unread chip + chevron */}
        <div className="flex items-center gap-2 shrink-0">
          {group.unread_count && group.unread_count > 0 ? (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold tabular-nums">
              {group.unread_count > 99 ? '99+' : group.unread_count}
            </span>
          ) : null}
          <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
        </div>
      </div>
    </Card>
  );
}

// Export name preserved so callers don't need to change. Drag-to-reorder
// was removed for a cleaner list; the grip handle on the left of each
// row added visual noise for a low-engagement power-user feature.
// Reordering can come back as a long-press affordance later if needed.
export function ReorderableGroupList({ groups }: ReorderableGroupListProps) {
  return (
    <div className="space-y-2.5">
      {groups.map((group) => (
        <GroupRow key={group.id} group={group} />
      ))}
    </div>
  );
}
