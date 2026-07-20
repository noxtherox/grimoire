import { invoke } from "@tauri-apps/api/core";

export interface MobileVaultLocation {
  url: string;
  name: string;
}

interface MobileVaultLocationResponse {
  vault: MobileVaultLocation | null;
}

export async function pickMobileVaultFolder(): Promise<MobileVaultLocation | null> {
  const response = await invoke<MobileVaultLocationResponse>(
    "plugin:mobile-vault|pick_vault_folder",
  );
  return response.vault;
}

export async function restoreMobileVaultFolder(): Promise<MobileVaultLocation | null> {
  const response = await invoke<MobileVaultLocationResponse>(
    "plugin:mobile-vault|restore_vault_folder",
  );
  return response.vault;
}

export async function clearMobileVaultFolder(): Promise<void> {
  await invoke("plugin:mobile-vault|clear_vault_folder");
}
