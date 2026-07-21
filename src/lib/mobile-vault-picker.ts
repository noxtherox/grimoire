import { invoke } from "@tauri-apps/api/core";

export interface MobileVaultLocation {
  url: string;
  name: string;
}

interface MobileVaultLocationResponse {
  vault: MobileVaultLocation | null;
}

export interface MobilePickedFile {
  path: string;
  name: string;
}

interface MobilePickedFilesResponse {
  files: MobilePickedFile[];
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

export async function pickMobileExternalNotes(): Promise<MobilePickedFile[]> {
  const response = await invoke<MobilePickedFilesResponse>(
    "plugin:mobile-vault|pick_external_notes",
  );
  return response.files;
}

export async function pickMobileFiles(): Promise<MobilePickedFile[]> {
  const response = await invoke<MobilePickedFilesResponse>(
    "plugin:mobile-vault|pick_files",
  );
  return response.files;
}

export async function openMobileFile(path: string): Promise<void> {
  await invoke("plugin:mobile-vault|open_file", { request: { path } });
}
