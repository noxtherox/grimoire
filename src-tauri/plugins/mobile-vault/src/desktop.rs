use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::models::*;

pub fn init<R: Runtime, C: DeserializeOwned>(
    app: &AppHandle<R>,
    _api: PluginApi<R, C>,
) -> crate::Result<MobileVault<R>> {
    Ok(MobileVault(app.clone()))
}

/// Access to the mobile-vault APIs.
pub struct MobileVault<R: Runtime>(AppHandle<R>);

impl<R: Runtime> MobileVault<R> {
    pub fn pick_vault_folder(&self) -> crate::Result<VaultLocationResponse> {
        Ok(VaultLocationResponse::default())
    }

    pub fn restore_vault_folder(&self) -> crate::Result<VaultLocationResponse> {
        Ok(VaultLocationResponse::default())
    }

    pub fn clear_vault_folder(&self) -> crate::Result<()> {
        Ok(())
    }

    pub fn pick_external_notes(&self) -> crate::Result<PickedFilesResponse> {
        Ok(PickedFilesResponse::default())
    }

    pub fn pick_files(&self) -> crate::Result<PickedFilesResponse> {
        Ok(PickedFilesResponse::default())
    }

    pub fn open_file(&self, _request: OpenFileRequest) -> crate::Result<()> {
        Ok(())
    }
}
