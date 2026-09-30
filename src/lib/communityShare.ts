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

export async function copyCommunityText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const input = document.createElement("textarea");
  input.value = text;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  try {
    input.select();
    if (!document.execCommand("copy")) throw new Error("Copy unavailable");
  } finally {
    input.remove();
  }
}

export async function shareCommunity(
  data: ShareData
): Promise<"shared" | "copied" | "cancelled"> {
  if (navigator.share) {
    try {
      await navigator.share(data);
      return "shared";
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError")
        return "cancelled";
    }
  }
  await copyCommunityText(`${data.text}\n${data.url}`);
  return "copied";
}
