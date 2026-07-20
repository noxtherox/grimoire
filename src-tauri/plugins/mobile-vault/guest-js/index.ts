import { invoke } from '@tauri-apps/api/core'

export interface VaultLocation {
  url: string
  name: string
}

interface VaultLocationResponse {
  vault: VaultLocation | null
}

export async function pickVaultFolder(): Promise<VaultLocation | null> {
  return invoke<VaultLocationResponse>('plugin:mobile-vault|pick_vault_folder')
    .then((response) => response.vault)
}

export async function restoreVaultFolder(): Promise<VaultLocation | null> {
  return invoke<VaultLocationResponse>('plugin:mobile-vault|restore_vault_folder')
    .then((response) => response.vault)
}

export async function clearVaultFolder(): Promise<void> {
  await invoke('plugin:mobile-vault|clear_vault_folder')
}
