use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

use crate::models::*;

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_mobile_vault);

// initializes the Kotlin or Swift plugin classes
pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> crate::Result<MobileVault<R>> {
    #[cfg(target_os = "android")]
    let handle = api.register_android_plugin("", "ExamplePlugin")?;
    #[cfg(target_os = "ios")]
    let handle = api.register_ios_plugin(init_plugin_mobile_vault)?;
    Ok(MobileVault(handle))
}

/// Access to the mobile-vault APIs.
pub struct MobileVault<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> MobileVault<R> {
    pub fn pick_vault_folder(&self) -> crate::Result<VaultLocationResponse> {
        self.0
            .run_mobile_plugin("pickVaultFolder", EmptyRequest::default())
            .map_err(Into::into)
    }

    pub fn restore_vault_folder(&self) -> crate::Result<VaultLocationResponse> {
        self.0
            .run_mobile_plugin("restoreVaultFolder", EmptyRequest::default())
            .map_err(Into::into)
    }

    pub fn clear_vault_folder(&self) -> crate::Result<()> {
        self.0
            .run_mobile_plugin("clearVaultFolder", EmptyRequest::default())
            .map_err(Into::into)
    }

    pub fn pick_external_notes(&self) -> crate::Result<PickedFilesResponse> {
        self.0
            .run_mobile_plugin("pickExternalNotes", EmptyRequest::default())
            .map_err(Into::into)
    }

    pub fn pick_files(&self) -> crate::Result<PickedFilesResponse> {
        self.0
            .run_mobile_plugin("pickFiles", EmptyRequest::default())
            .map_err(Into::into)
    }

    pub fn open_file(&self, request: OpenFileRequest) -> crate::Result<()> {
        self.0
            .run_mobile_plugin("openFile", request)
            .map_err(Into::into)
    }
}
