import { openUrl } from "@tauri-apps/plugin-opener";

const WEB_PROTOCOLS = new Set(["http:", "https:"]);

/** Turn a web link or bare domain into a URL that is safe to hand to the OS. */
export function normalizeExternalUrl(value: string): string | null {
  const trimmed = value.trim().replace(/^<|>$/g, "");
  if (!trimmed) return null;

  const candidate = /^[a-z][a-z\d+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    return WEB_PROTOCOLS.has(url.protocol) && url.hostname ? url.href : null;
  } catch {
    return null;
  }
}

/** Open a web link in the user's default browser in desktop and web builds. */
export async function openExternalUrl(value: string): Promise<boolean> {
  const url = normalizeExternalUrl(value);
  if (!url) return false;

  if ("__TAURI_INTERNALS__" in window) {
    try {
      await openUrl(url);
    } catch {
      return false;
    }
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
  return true;
}
