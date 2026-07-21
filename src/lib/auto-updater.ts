import { isTauri } from "@tauri-apps/api/core";
import { toast } from "sonner";

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

let checkInProgress = false;
let lastCheckAt = 0;

async function checkAndInstallUpdate() {
  const now = Date.now();
  if (checkInProgress || now - lastCheckAt < CHECK_INTERVAL_MS) return;

  checkInProgress = true;
  lastCheckAt = now;

  try {
    const [{ check }, { relaunch }] = await Promise.all([
      import("@tauri-apps/plugin-updater"),
      import("@tauri-apps/plugin-process"),
    ]);
    const update = await check({ timeout: 30_000 });
    if (!update) return;

    const toastId = toast.loading(`Downloading Grimoire ${update.version}…`);
    let downloaded = 0;
    let total: number | undefined;

    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          if (total) {
            const percent = Math.min(100, Math.round((downloaded / total) * 100));
            toast.loading(`Downloading Grimoire ${update.version}… ${percent}%`, {
              id: toastId,
            });
          }
        } else {
          toast.loading("Update installed. Restarting Grimoire…", {
            id: toastId,
          });
        }
      });
      await relaunch();
    } catch (error) {
      toast.error(`Grimoire ${update.version} could not be installed.`, {
        id: toastId,
        description: String(error),
      });
    } finally {
      await update.close().catch(() => undefined);
    }
  } catch (error) {
    console.warn("Grimoire update check failed", error);
  } finally {
    checkInProgress = false;
  }
}

export function startAutoUpdater() {
  if (!import.meta.env.PROD || !isTauri()) return undefined;

  const check = () => void checkAndInstallUpdate();
  const checkWhenVisible = () => {
    if (document.visibilityState === "visible") check();
  };

  check();
  const interval = window.setInterval(check, CHECK_INTERVAL_MS);
  window.addEventListener("focus", check);
  document.addEventListener("visibilitychange", checkWhenVisible);

  return () => {
    window.clearInterval(interval);
    window.removeEventListener("focus", check);
    document.removeEventListener("visibilitychange", checkWhenVisible);
  };
}
