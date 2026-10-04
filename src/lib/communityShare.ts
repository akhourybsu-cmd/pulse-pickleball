// Shared links must work outside the installed app, whose origin can be localhost.
export const communityPath = (id: string) =>
  `/player/community/group/${encodeURIComponent(id)}`;
export const communityInvitePath = (code: string) =>
  `/player/community/join/${encodeURIComponent(code.trim())}`;
export const communityUrl = (id: string) =>
  `https://pulsepb.com${communityPath(id)}`;
export const communityInviteUrl = (code: string) =>
  `https://pulsepb.com${communityInvitePath(code)}`;

export const communityShareTarget = (shareUrl?: string, inviteCode?: string | null) =>
  shareUrl || (inviteCode ? communityInviteUrl(inviteCode) : undefined);

export function communityShareData(name: string, url: string): ShareData {
  return {
    title: `Join ${name}`,
    text: `Join ${name} on PULSE. Find your people and your next game.`,
    url,
  };
}

export { copyText as copyCommunityText, shareLink as shareCommunity } from './share';
