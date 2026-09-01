import { describe, expect, it } from 'vitest';
import { isInVenueFilter } from './feed';

const memberPost = {
  type: 'feed' as const,
  pinned: false,
  user_id: 'member-1',
  image_url: null,
};

describe('venue feed filters', () => {
  const staffIds = new Set(['staff-1']);

  it('treats announcements, pinned posts, and staff posts as venue updates', () => {
    expect(isInVenueFilter({ ...memberPost, type: 'announcement' }, 'venue', staffIds)).toBe(true);
    expect(isInVenueFilter({ ...memberPost, pinned: true }, 'venue', staffIds)).toBe(true);
    expect(isInVenueFilter({ ...memberPost, user_id: 'staff-1' }, 'venue', staffIds)).toBe(true);
    expect(isInVenueFilter(memberPost, 'venue', staffIds)).toBe(false);
  });

  it('keeps player requests, polls, and photos in their own focused views', () => {
    expect(isInVenueFilter({ ...memberPost, type: 'lfg' }, 'players', staffIds)).toBe(true);
    expect(isInVenueFilter({ ...memberPost, type: 'round_robin' }, 'players', staffIds)).toBe(true);
    expect(isInVenueFilter({ ...memberPost, type: 'poll' }, 'polls', staffIds)).toBe(true);
    expect(isInVenueFilter({ ...memberPost, image_url: '/photo.jpg' }, 'photos', staffIds)).toBe(true);
    expect(isInVenueFilter(memberPost, 'all', staffIds)).toBe(true);
  });
});
