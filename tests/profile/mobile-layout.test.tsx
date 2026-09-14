import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { Gauge } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import PlayerProfile from '@/pages/player/PlayerProfile';
import { SocialHero, SocialStatTile } from '@/components/social/_shared';
import { SkillAssessmentCTA } from '@/components/skill/SkillAssessmentCTA';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/lib/permissions', () => ({ isPlatformAdmin: vi.fn() }));
vi.mock('@/lib/skill/featureFlag', () => ({ isSkillAssessmentEnabled: () => true }));

describe('mobile Profile layout guards', () => {
  it('uses shrinkable tracks on phones and keeps the desktop two-column layout', () => {
    const html = renderToStaticMarkup(<MemoryRouter><PlayerProfile /></MemoryRouter>);
    expect(html).toContain('grid min-w-0 grid-cols-1');
    expect(html).toContain('lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]');
    expect(html.match(/class="min-w-0 space-y-7"/g)).toHaveLength(2);
    expect(html).not.toContain('minmax(460px');
  });

  it('wraps menu descriptions without hiding information or removing destinations', () => {
    const html = renderToStaticMarkup(<MemoryRouter><PlayerProfile /></MemoryRouter>);
    expect(html).toContain('break-words text-xs leading-relaxed');
    expect(html).not.toContain('truncate');
    for (const label of ['Payments &amp; purchases', 'Edit profile', 'Notifications', 'Security', 'My Events', 'My Guests', 'Sign out']) {
      expect(html).toContain(label);
    }
  });

  it('gives stats the full content width instead of squeezing them beside the avatar', () => {
    const html = renderToStaticMarkup(<MemoryRouter><PlayerProfile /></MemoryRouter>);
    expect(html).toContain('data-testid="profile-stats" class="mt-3 grid min-w-0 max-w-2xl grid-cols-3');
    expect(html).toContain('data-testid="profile-identity"');
    expect(html).toContain('h-auto min-h-12');
    expect(html).not.toContain('grid min-w-0 flex-1 grid-cols-3');
  });

  it('allows long identity text and stat values to wrap within their own cells', () => {
    const name = 'AlexandriaSuperLongUnbrokenFamilyName';
    const hero = renderToStaticMarkup(<SocialHero eyebrow="Player" title={name} action={<button>Edit profile</button>} />);
    expect(hero).toContain('<h1 class="break-words');
    expect(hero).toContain(name);
    const tile = renderToStaticMarkup(<SocialStatTile icon={Gauge} label="Matches" value="123456789" />);
    expect(tile).toContain('flex flex-wrap');
    expect(tile).toContain('mt-0.5 break-words');
    expect(tile).toContain('123456789');
  });

  it('lets the optional assessment button grow vertically on narrow phones', () => {
    const html = renderToStaticMarkup(<MemoryRouter><SkillAssessmentCTA userId="sample" /></MemoryRouter>);
    expect(html).toContain('h-auto min-h-11');
    expect(html).toContain('whitespace-normal');
    expect(html).toContain('data-testid="profile-assessment-actions" class="relative mt-3 min-w-0"');
    expect(html).toContain('class="min-w-0 break-words">Take the Skill Assessment');
    expect(html).toContain('Take the Skill Assessment');
  });
});
