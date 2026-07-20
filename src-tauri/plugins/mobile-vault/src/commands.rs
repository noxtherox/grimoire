use tauri::{command, AppHandle, Runtime};

use crate::models::*;
use crate::MobileVaultExt;
use crate::Result;

#[command]
pub(crate) async fn pick_vault_folder<R: Runtime>(
    app: AppHandle<R>,
) -> Result<VaultLocationResponse> {
    app.mobile_vault().pick_vault_folder()
}

#[command]
pub(crate) async fn restore_vault_folder<R: Runtime>(
    app: AppHandle<R>,
) -> Result<VaultLocationResponse> {
    app.mobile_vault().restore_vault_folder()
}

#[command]
pub(crate) async fn clear_vault_folder<R: Runtime>(app: AppHandle<R>) -> Result<()> {
    app.mobile_vault().clear_vault_folder()
}
