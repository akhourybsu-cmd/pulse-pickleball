import { MessageCircle, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface MemberActionTarget {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  rating: number | null;
}

interface MemberActionSheetProps {
  target: MemberActionTarget | null;
  onClose: () => void;
  onMessage: (userId: string) => void;
}

/**
 * Bottom sheet that pops up when a roster row is tapped.
 *
 * Two actions:
 *   1. Message — opens in-app DM (handled by parent via onMessage).
 *   2. View profile — navigates to /profile/:userId.
 *
 * There is no Call/Text: phone numbers aren't exposed through the public
 * profile view (privacy), so those actions could never work — we don't show
 * dead affordances. In-app messaging is the contact path.
 */
export function MemberActionSheet({ target, onClose, onMessage }: MemberActionSheetProps) {
  const navigate = useNavigate();
  const open = target != null;

  const initials = (target?.displayName ?? 'U')
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const actions: {
    key: string;
    label: string;
    sub?: string;
    icon: typeof User;
    disabled?: boolean;
    onClick?: () => void;
    tone?: 'primary' | 'default';
  }[] = [
    {
      key: 'message',
      label: 'Message in PULSE',
      sub: 'Direct message',
      icon: MessageCircle,
      tone: 'primary',
      onClick: () => {
        if (!target) return;
        onMessage(target.userId);
        onClose();
      },
    },
    {
      key: 'profile',
      label: 'View profile',
      sub: 'Stats, rating, and recent matches',
      icon: User,
      onClick: () => {
        if (!target) return;
        navigate(`/profile/${target.userId}`);
        onClose();
      },
    },
  ];

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="h-auto rounded-t-2xl p-0 max-w-md mx-auto">
        <SheetHeader className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={target?.avatarUrl ?? undefined} />
              <AvatarFallback className="bg-primary/15 text-primary font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div className="text-left min-w-0">
              <SheetTitle className="text-base truncate">{target?.displayName ?? ''}</SheetTitle>
              {target?.rating != null && (
                <Badge variant="outline" className="mt-1 h-5 text-[10px]">
                  {target.rating.toFixed(2)} rating
                </Badge>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="px-3 pb-5 space-y-1">
          {actions.map((a) => {
            const Icon = a.icon;
            const inner = (
              <>
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full flex-shrink-0',
                    a.disabled
                      ? 'bg-muted text-muted-foreground/50'
                      : a.tone === 'primary'
                        ? 'bg-primary/15 text-primary'
                        : 'bg-muted text-foreground/80',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className={cn('text-sm font-semibold', a.disabled && 'text-muted-foreground')}>
                    {a.label}
                  </div>
                  {a.sub && (
                    <div
                      className={cn(
                        'text-xs truncate',
                        a.disabled ? 'text-muted-foreground/60' : 'text-muted-foreground',
                      )}
                    >
                      {a.sub}
                    </div>
                  )}
                </div>
              </>
            );

            return (
              <button
                key={a.key}
                type="button"
                onClick={a.onClick}
                className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg transition-colors hover:bg-muted/60 active:bg-muted"
              >
                {inner}
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
