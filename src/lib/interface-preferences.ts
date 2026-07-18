const INTERFACE_ZOOM_STORAGE_KEY = "grimoire.interfaceZoom";

export const INTERFACE_ZOOM_OPTIONS = [80, 90, 100, 110, 125, 150] as const;
export type InterfaceZoom = (typeof INTERFACE_ZOOM_OPTIONS)[number];
export const DEFAULT_INTERFACE_ZOOM: InterfaceZoom = 100;

function isInterfaceZoom(value: unknown): value is InterfaceZoom {
  return INTERFACE_ZOOM_OPTIONS.some((option) => option === value);
}

/** Loads the app-wide interface zoom saved on this device. */
export function loadInterfaceZoom(): InterfaceZoom {
  try {
    const saved = Number(localStorage.getItem(INTERFACE_ZOOM_STORAGE_KEY));
    return isInterfaceZoom(saved) ? saved : DEFAULT_INTERFACE_ZOOM;
  } catch {
    return DEFAULT_INTERFACE_ZOOM;
  }
}

/** Scales text, controls, icons, and layout together. */
export function applyInterfaceZoom(zoom: InterfaceZoom): void {
  document.documentElement.style.setProperty("zoom", String(zoom / 100));
}

/** Saves and immediately applies the app-wide interface zoom. */
export function saveInterfaceZoom(zoom: InterfaceZoom): void {
  applyInterfaceZoom(zoom);
  try {
    localStorage.setItem(INTERFACE_ZOOM_STORAGE_KEY, String(zoom));
  } catch {
    // Persistence is best-effort; the zoom still applies for this session.
  }
}

/** Applies the saved zoom once during startup. */
export function initInterfaceZoom(): void {
  applyInterfaceZoom(loadInterfaceZoom());
}
