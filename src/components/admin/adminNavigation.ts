import { Activity, Archive, Building2, LayoutDashboard, ShieldCheck, Users, FileText, History, Shield } from 'lucide-react';
export const ADMIN_NAVIGATION = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, group: 'Platform' },
  { href: '/admin/venue-requests', label: 'Venue approvals', icon: ShieldCheck, group: 'Platform' },
  { href: '/admin/venues', label: 'Venues & feature access', icon: Building2, group: 'Platform' },
  { href: '/admin/activity', label: 'Platform activity', icon: History, group: 'Platform' },
  { href: '/admin/players', label: 'Player directory', icon: Users, group: 'Support' },
  { href: '/admin/matches', label: 'Match review', icon: FileText, group: 'Support' },
  { href: '/admin/system-health', label: 'System health', icon: Activity, group: 'Support' },
  { href: '/admin/audit-log', label: 'Security audit', icon: Shield, group: 'Support' },
  { href: '/archive', label: 'Archived tools', icon: Archive, group: 'Maintenance' },
] as const;

