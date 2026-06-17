import { Phone, MessageSquare, MessageCircle, User } from 'lucide-react';
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
  phoneNumber: string | null;
}

interface MemberActionSheetProps {
  target: MemberActionTarget | null;
  onClose: () => void;
  onMessage: (userId: string) => void;
}

/**
 * Bottom sheet that pops up when a roster row is tapped.
 *
 * Four actions in TeamReach order of importance for a recreational
 * organizer:
 *   1. Call — opens dialer (tel: link). Hidden when phone is null.
 *   2. Text — opens SMS (sms: link). Hidden when phone is null.
 *   3. Message — opens in-app DM (handled by parent via onMessage).
 *   4. View profile — navigates to /profile/:userId.
 *
 * Phone is only available because GroupMembers.fetch surfaces it for
 * fellow active members (RLS already gates the profiles select). When
 * phone is null the call/text rows render disabled with a helper
 * footnote so the user understands why.
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

  const hasPhone = !!target?.phoneNumber;
  // Normalize for tel/sms — strip everything except digits + leading +.
  const dialNumber = target?.phoneNumber
    ? target.phoneNumber.replace(/[^\d+]/g, '')
    : '';

  const actions: {
    key: string;
    label: string;
    sub?: string;
    icon: typeof Phone;
    disabled?: boolean;
    onClick?: () => void;
    href?: string;
    tone?: 'primary' | 'default';
  }[] = [
    {
      key: 'call',
      label: 'Call',
      sub: hasPhone ? target!.phoneNumber! : 'No phone on file',
      icon: Phone,
      disabled: !hasPhone,
      href: hasPhone ? `tel:${dialNumber}` : undefined,
      tone: 'primary',
    },
    {
      key: 'text',
      label: 'Text',
      sub: hasPhone ? 'SMS' : 'No phone on file',
      icon: MessageSquare,
      disabled: !hasPhone,
      href: hasPhone ? `sms:${dialNumber}` : undefined,
    },
    {
      key: 'message',
      label: 'Message in PULSE',
      sub: 'Direct message',
      icon: MessageCircle,
      onClick: () => {
        if (!target) return;
        onMessage(target.userId);
        onClose();
      },
    },
    {
      key: 'profile',
      label: 'View profile',
      sub: 'Stats, rating, recent matches',
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

            // Use a real <a> for tel:/sms: so the OS handles them.
            if (a.href && !a.disabled) {
              return (
                <a
                  key={a.key}
                  href={a.href}
                  onClick={onClose}
                  className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-muted/60 active:bg-muted transition-colors"
                >
                  {inner}
                </a>
              );
            }
            return (
              <button
                key={a.key}
                type="button"
                disabled={a.disabled}
                onClick={a.onClick}
                className={cn(
                  'w-full flex items-center gap-3 px-2 py-2.5 rounded-lg transition-colors',
                  a.disabled
                    ? 'cursor-not-allowed'
                    : 'hover:bg-muted/60 active:bg-muted',
                )}
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
