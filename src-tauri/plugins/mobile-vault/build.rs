const COMMANDS: &[&str] = &[
    "pick_vault_folder",
    "restore_vault_folder",
    "clear_vault_folder",
    "pick_external_notes",
    "pick_files",
    "open_file",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .ios_path("ios")
        .build();
}
