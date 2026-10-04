/** Links shared outside PULSE must not inherit a native or development origin. */
export function publicAppUrl(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//") || /[\\\s]/.test(path)) {
    throw new Error("A local PULSE path is required");
  }
  return `https://pulsepb.com${path}`;
}

export const playerProfilePath = (id: string) =>
  `/profile/${encodeURIComponent(id)}`;
export const playerProfileUrl = (id: string) =>
  publicAppUrl(playerProfilePath(id));

export async function copyText(text: string): Promise<void> {
  let clipboardError: unknown;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch (error) {
    clipboardError = error;
  }
  // Some embedded browsers expose Clipboard but deny access. Try selection too.
  if (typeof document === "undefined" || !document.execCommand) {
    throw clipboardError || new Error("Copy unavailable");
  }
  const active = document.activeElement as HTMLElement | null;
  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  try {
    input.select();
    if (!document.execCommand("copy"))
      throw clipboardError || new Error("Copy unavailable");
  } finally {
    input.remove();
    active?.focus({ preventScroll: true });
  }
}

export async function shareLink(
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
  await copyText(
    [data.text, data.url].filter(Boolean).join("\n") || data.title || ""
  );
  return "copied";
}
