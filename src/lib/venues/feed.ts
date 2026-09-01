import type { GroupPost } from '@/hooks/useGroupPosts';

export type VenueFeedFilter = 'all' | 'venue' | 'players' | 'polls' | 'photos';

type FilterablePost = Pick<GroupPost, 'type' | 'pinned' | 'user_id' | 'image_url'>;

/** Match a post against the player-facing venue Feed's intent filters. */
export function isInVenueFilter(
  post: FilterablePost,
  filter: VenueFeedFilter,
  staffUserIds: ReadonlySet<string>,
): boolean {
  switch (filter) {
    case 'venue':
      return post.type === 'announcement' || post.pinned || staffUserIds.has(post.user_id);
    case 'players':
      return post.type === 'lfg' || post.type === 'round_robin';
    case 'polls':
      return post.type === 'poll';
    case 'photos':
      return Boolean(post.image_url);
    default:
      return true;
  }
}
