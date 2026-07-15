use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::Path;

fn write_new_vault_file_impl(
    root: &Path,
    relative_path: &str,
    content: &[u8],
) -> Result<(), String> {
    let segments: Vec<&str> = relative_path.split(['/', '\\']).collect();
    if segments.is_empty()
        || segments
            .iter()
            .any(|segment| segment.is_empty() || *segment == "." || *segment == "..")
    {
        return Err("Unsafe vault-relative path".to_string());
    }

    let mut parent = root.canonicalize().map_err(|error| error.to_string())?;
    for segment in &segments[..segments.len() - 1] {
        let next = parent.join(segment);
        match fs::symlink_metadata(&next) {
            Ok(metadata) => {
                if metadata.file_type().is_symlink() || !metadata.is_dir() {
                    return Err("Vault path contains a symlink or non-directory".to_string());
                }
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                fs::create_dir(&next).map_err(|error| error.to_string())?;
            }
            Err(error) => return Err(error.to_string()),
        }
        parent = next;
    }

    let target = parent.join(segments[segments.len() - 1]);
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(target)
        .map_err(|error| error.to_string())?;
    file.write_all(content).map_err(|error| error.to_string())?;
    file.sync_all().map_err(|error| error.to_string())
}

#[tauri::command]
fn write_new_vault_file(
    root: String,
    relative_path: String,
    content: String,
) -> Result<(), String> {
    write_new_vault_file_impl(Path::new(&root), &relative_path, content.as_bytes())
}

#[tauri::command]
fn canonicalize_path(path: String) -> Result<String, String> {
    Path::new(&path)
        .canonicalize()
        .map(|path| path.to_string_lossy().into_owned())
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn reveal_in_file_manager(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let status = std::process::Command::new("open")
        .args(["-R", &path])
        .status();

    #[cfg(target_os = "windows")]
    let status = std::process::Command::new("explorer")
        .arg(format!("/select,{}", path))
        .status();

    #[cfg(target_os = "linux")]
    let status = {
        let parent = std::path::Path::new(&path)
            .parent()
            .ok_or_else(|| "The note has no parent folder".to_string())?;
        std::process::Command::new("xdg-open").arg(parent).status()
    };

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    let status = Err::<std::process::ExitStatus, _>(std::io::Error::new(
        std::io::ErrorKind::Unsupported,
        "Revealing files is not supported on this platform",
    ));

    status
        .map_err(|error| error.to_string())?
        .success()
        .then_some(())
        .ok_or_else(|| "The file manager could not reveal the note".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            reveal_in_file_manager,
            write_new_vault_file,
            canonicalize_path
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::write_new_vault_file_impl;
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_root(name: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock should follow the Unix epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("grimoire-{name}-{}-{nonce}", std::process::id()))
    }

    #[test]
    fn creates_a_new_file_but_never_overwrites_it() {
        let root = test_root("create-new");
        fs::create_dir(&root).expect("create test vault");
        write_new_vault_file_impl(&root, "inbox/Note.md", b"first").expect("create new note");
        assert!(write_new_vault_file_impl(&root, "inbox/Note.md", b"second").is_err());
        assert_eq!(
            fs::read_to_string(root.join("inbox/Note.md")).expect("read note"),
            "first"
        );
        fs::remove_dir_all(root).expect("remove test vault");
    }

    #[cfg(unix)]
    #[test]
    fn rejects_a_type_directory_that_is_a_symlink() {
        use std::os::unix::fs::symlink;

        let root = test_root("symlink-vault");
        let outside = test_root("symlink-outside");
        fs::create_dir(&root).expect("create test vault");
        fs::create_dir(&outside).expect("create outside folder");
        symlink(&outside, root.join("research")).expect("create symlinked type");

        assert!(write_new_vault_file_impl(&root, "research/Note.md", b"outside").is_err());
        assert!(!outside.join("Note.md").exists());

        fs::remove_dir_all(root).expect("remove test vault");
        fs::remove_dir_all(outside).expect("remove outside folder");
    }
}
