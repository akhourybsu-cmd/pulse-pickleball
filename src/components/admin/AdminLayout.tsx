import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Menu, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Logo } from '@/components/Logo';
import { cn } from '@/lib/utils';
import { ADMIN_NAVIGATION } from './adminNavigation';

export const AdminLayout = ({ title = 'Platform overview', subtitle, children }: { title?: string; subtitle?: string; children: ReactNode }) => {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const navigation = (mobile = false) => <nav aria-label={mobile ? 'Mobile platform administration' : 'Platform administration'} className="space-y-6">
    {['Platform', 'Support', 'Maintenance'].map(group => <div key={group}>
      <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{group}</p>
      <div className="space-y-1">{ADMIN_NAVIGATION.filter(item => item.group === group).map(item => <Link key={item.href} to={item.href} onClick={() => setOpen(false)} aria-current={pathname === item.href ? 'page' : undefined} className={cn('flex min-h-11 min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary', pathname === item.href ? 'bg-primary/10 font-semibold text-foreground ring-1 ring-primary/20' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
        <item.icon className="h-4 w-4 shrink-0" /><span className="min-w-0 [overflow-wrap:anywhere]">{item.label}</span>
      </Link>)}</div>
    </div>)}
    <Link to="/player/dashboard" className="flex min-h-11 items-center gap-2 border-t px-3 pt-4 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back to PULSE</Link>
  </nav>;
  return <div className="min-h-dvh min-w-0 bg-background font-sans [&_h1]:font-sans [&_h2]:font-sans [&_h3]:font-sans [&_h4]:font-sans">
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#101c24] text-white">
      <div className="mx-auto flex min-h-16 w-full max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/admin" aria-label="PULSE platform overview" className="flex min-w-0 items-center gap-4"><Logo className="h-7 w-auto max-w-[110px]" /><span className="hidden border-l border-white/20 pl-4 text-xs font-medium tracking-wide text-white/65 sm:block">PLATFORM ADMIN</span></Link>
        <div className="flex shrink-0 items-center gap-2"><span className="hidden items-center gap-1.5 rounded-full border border-primary/30 px-3 py-1.5 text-xs text-primary md:flex"><ShieldCheck className="h-3.5 w-3.5" />Superadmin</span><div className="text-foreground"><ThemeToggle /></div>
          <Sheet open={open} onOpenChange={setOpen}><SheetTrigger asChild><Button variant="ghost" size="icon" className="h-11 w-11 text-white hover:bg-white/10 hover:text-white lg:hidden" aria-label="Open admin navigation"><Menu className="h-5 w-5" /></Button></SheetTrigger>
            <SheetContent className="flex w-[min(340px,100vw)] max-w-full flex-col gap-0 p-0 font-sans"><SheetHeader className="border-b px-5 pb-4 pt-6 text-left"><SheetTitle className="font-sans">Platform administration</SheetTitle><SheetDescription>Approvals, feature access and support.</SheetDescription></SheetHeader><div className="min-h-0 flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{navigation(true)}</div></SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
    <div className="mx-auto grid w-full min-w-0 max-w-[1600px] lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] overflow-y-auto border-r p-5 lg:block">{navigation()}</aside>
      <main className="min-w-0 pb-10"><div className="px-4 pb-1 pt-6 sm:px-6 lg:px-8 lg:pt-8"><p className="text-xs font-medium text-muted-foreground">PULSE control center</p><h1 className="mt-2 text-2xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-3xl">{title}</h1>{subtitle && <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{subtitle}</p>}</div>{children}</main>
    </div>
  </div>;
};
