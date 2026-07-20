const COMMANDS: &[&str] = &[
    "pick_vault_folder",
    "restore_vault_folder",
    "clear_vault_folder",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .ios_path("ios")
        .build();
}
