use std::fs::{self, OpenOptions};
use std::io::{Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use tauri::{Emitter, Manager};

#[derive(Default)]
struct PendingOpenFiles(Mutex<Vec<String>>);

#[derive(Clone, Default)]
struct TerminalManager(Arc<TerminalManagerInner>);

#[derive(Default)]
struct TerminalManagerInner {
    session: Mutex<Option<TerminalSession>>,
    next_id: AtomicU64,
}

struct TerminalSession {
    id: u64,
    cwd: String,
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
    killer: Box<dyn ChildKiller + Send + Sync>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TerminalSessionInfo {
    session_id: u64,
    working_directory: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TerminalOutput {
    session_id: u64,
    data: Vec<u8>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TerminalExit {
    session_id: u64,
    exit_code: Option<u32>,
    signal: Option<String>,
    error: Option<String>,
}

fn configured_shell() -> String {
    #[cfg(target_os = "windows")]
    {
        std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string())
    }

    #[cfg(not(target_os = "windows"))]
    {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string())
    }
}

fn validated_terminal_directory(path: &str) -> Result<std::path::PathBuf, String> {
    let directory = Path::new(path)
        .canonicalize()
        .map_err(|error| format!("Could not open the note folder: {error}"))?;
    if !directory.is_dir() {
        return Err("The terminal working path is not a folder".to_string());
    }
    Ok(directory)
}

#[tauri::command]
fn terminal_status(state: tauri::State<'_, TerminalManager>) -> Option<TerminalSessionInfo> {
    let session = state
        .0
        .session
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    session.as_ref().map(|session| TerminalSessionInfo {
        session_id: session.id,
        working_directory: session.cwd.clone(),
    })
}

#[tauri::command]
fn terminal_start(
    app: tauri::AppHandle,
    state: tauri::State<'_, TerminalManager>,
    working_directory: String,
    rows: u16,
    cols: u16,
) -> Result<TerminalSessionInfo, String> {
    let directory = validated_terminal_directory(&working_directory)?;
    let canonical_directory = directory.to_string_lossy().into_owned();

    {
        let session = state
            .0
            .session
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if session.is_some() {
            return Err("A terminal session is already running".to_string());
        }
    }

    let pair = native_pty_system()
        .openpty(PtySize {
            rows: rows.max(1),
            cols: cols.max(1),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| format!("Could not create a terminal: {error}"))?;

    let shell = configured_shell();
    let mut command = CommandBuilder::new(&shell);
    #[cfg(not(target_os = "windows"))]
    command.arg("-l");
    command.cwd(&directory);
    command.env("TERM", "xterm-256color");
    command.env("COLORTERM", "truecolor");

    let mut child = pair
        .slave
        .spawn_command(command)
        .map_err(|error| format!("Could not start {shell}: {error}"))?;
    let killer = child.clone_killer();
    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|error| format!("Could not read terminal output: {error}"))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|error| format!("Could not write to the terminal: {error}"))?;

    let session_id = state.0.next_id.fetch_add(1, Ordering::Relaxed) + 1;
    let info = TerminalSessionInfo {
        session_id,
        working_directory: canonical_directory.clone(),
    };
    let manager = state.inner().clone();
    {
        let mut session = manager
            .0
            .session
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        *session = Some(TerminalSession {
            id: session_id,
            cwd: canonical_directory,
            writer,
            master: pair.master,
            killer,
        });
    }

    let output_app = app.clone();
    std::thread::spawn(move || {
        let mut buffer = vec![0_u8; 8 * 1024];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(count) => {
                    let _ = output_app.emit(
                        "grimoire-terminal-output",
                        TerminalOutput {
                            session_id,
                            data: buffer[..count].to_vec(),
                        },
                    );
                }
                Err(error) if error.kind() == std::io::ErrorKind::Interrupted => continue,
                Err(_) => break,
            }
        }
    });

    let exit_app = app;
    std::thread::spawn(move || {
        let result = child.wait();
        {
            let mut active = manager
                .0
                .session
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            if active
                .as_ref()
                .is_some_and(|session| session.id == session_id)
            {
                active.take();
            }
        }
        let payload = match result {
            Ok(status) => TerminalExit {
                session_id,
                exit_code: Some(status.exit_code()),
                signal: status.signal().map(str::to_string),
                error: None,
            },
            Err(error) => TerminalExit {
                session_id,
                exit_code: None,
                signal: None,
                error: Some(error.to_string()),
            },
        };
        let _ = exit_app.emit("grimoire-terminal-exit", payload);
    });

    Ok(info)
}

#[tauri::command]
fn terminal_write(
    state: tauri::State<'_, TerminalManager>,
    session_id: u64,
    data: String,
) -> Result<(), String> {
    let mut active = state
        .0
        .session
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    let session = active
        .as_mut()
        .filter(|session| session.id == session_id)
        .ok_or_else(|| "The terminal session is no longer running".to_string())?;
    session
        .writer
        .write_all(data.as_bytes())
        .and_then(|_| session.writer.flush())
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn terminal_resize(
    state: tauri::State<'_, TerminalManager>,
    session_id: u64,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    let active = state
        .0
        .session
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    let session = active
        .as_ref()
        .filter(|session| session.id == session_id)
        .ok_or_else(|| "The terminal session is no longer running".to_string())?;
    session
        .master
        .resize(PtySize {
            rows: rows.max(1),
            cols: cols.max(1),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn terminal_stop(state: tauri::State<'_, TerminalManager>, session_id: u64) -> Result<(), String> {
    let mut active = state
        .0
        .session
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    if !active
        .as_ref()
        .is_some_and(|session| session.id == session_id)
    {
        return Err("The terminal session is no longer running".to_string());
    }
    let mut session = active.take().expect("checked active terminal session");
    session.killer.kill().map_err(|error| error.to_string())
}

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

fn safe_file_name(name: &str) -> bool {
    !name.is_empty()
        && name != "."
        && name != ".."
        && !name.chars().any(|value| matches!(value, '/' | '\\' | '\0'))
}

#[tauri::command]
fn copy_file_into_vault(
    source: String,
    root: String,
    relative_directory: String,
    file_name: String,
) -> Result<String, String> {
    if !safe_file_name(&file_name) {
        return Err("Unsafe document filename".to_string());
    }
    let source = Path::new(&source)
        .canonicalize()
        .map_err(|error| format!("Could not read the source document: {error}"))?;
    if !source.is_file() {
        return Err("The selected document is not a regular file".to_string());
    }
    let root = Path::new(&root)
        .canonicalize()
        .map_err(|error| format!("Could not open the vault: {error}"))?;
    let segments: Vec<&str> = relative_directory
        .split('/')
        .filter(|segment| !segment.is_empty())
        .collect();
    if segments.iter().any(|segment| !safe_file_name(segment)) {
        return Err("Unsafe vault-relative directory".to_string());
    }
    let mut directory = root.clone();
    for segment in segments {
        directory.push(segment);
        let metadata = fs::symlink_metadata(&directory)
            .map_err(|error| format!("Could not inspect the destination: {error}"))?;
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            return Err("The destination contains a symlink or non-directory".to_string());
        }
    }
    let name_path = Path::new(&file_name);
    let stem = name_path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("Document");
    let extension = name_path.extension().and_then(|value| value.to_str());
    for index in 0_u32.. {
        let suffix = if index == 0 {
            String::new()
        } else {
            format!(" {}", index + 1)
        };
        let candidate_name = match extension {
            Some(extension) => format!("{stem}{suffix}.{extension}"),
            None => format!("{stem}{suffix}"),
        };
        let target = directory.join(&candidate_name);
        if target.exists() {
            continue;
        }
        fs::copy(&source, &target)
            .map_err(|error| format!("Could not copy the document into the vault: {error}"))?;
        let relative = if relative_directory.is_empty() {
            candidate_name
        } else {
            format!("{relative_directory}/{candidate_name}")
        };
        return Ok(relative);
    }
    unreachable!()
}

#[tauri::command]
fn take_pending_open_files(state: tauri::State<'_, PendingOpenFiles>) -> Vec<String> {
    let mut paths = state.0.lock().unwrap_or_else(|error| error.into_inner());
    std::mem::take(&mut *paths)
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
    let app = tauri::Builder::default()
        .manage(PendingOpenFiles::default())
        .manage(TerminalManager::default())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            reveal_in_file_manager,
            write_new_vault_file,
            copy_file_into_vault,
            canonicalize_path,
            take_pending_open_files,
            terminal_status,
            terminal_start,
            terminal_write,
            terminal_resize,
            terminal_stop
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
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Opened { urls } = event {
            let paths: Vec<String> = urls
                .into_iter()
                .filter_map(|url| url.to_file_path().ok())
                .map(|path| path.to_string_lossy().into_owned())
                .collect();
            if paths.is_empty() {
                return;
            }

            app_handle
                .state::<PendingOpenFiles>()
                .0
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .extend(paths);
            let _ = app_handle.emit("grimoire-open-files", ());
        }
    });
}

#[cfg(test)]
mod tests {
    use super::{copy_file_into_vault, write_new_vault_file_impl};
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

    #[test]
    fn copies_documents_without_overwriting_an_existing_name() {
        let root = test_root("copy-vault");
        let source_dir = test_root("copy-source");
        fs::create_dir_all(root.join("work")).expect("create vault type");
        fs::create_dir(&source_dir).expect("create source folder");
        let source = source_dir.join("Proposal.pdf");
        fs::write(&source, b"portable document").expect("write source");
        fs::write(root.join("work/Proposal.pdf"), b"existing").expect("write collision");

        let copied = copy_file_into_vault(
            source.to_string_lossy().into_owned(),
            root.to_string_lossy().into_owned(),
            "work".to_string(),
            "Proposal.pdf".to_string(),
        )
        .expect("copy document");
        assert_eq!(copied, "work/Proposal 2.pdf");
        assert_eq!(
            fs::read(root.join(&copied)).expect("read copied document"),
            b"portable document"
        );
        assert_eq!(
            fs::read(root.join("work/Proposal.pdf")).expect("read existing document"),
            b"existing"
        );

        fs::remove_dir_all(root).expect("remove test vault");
        fs::remove_dir_all(source_dir).expect("remove source folder");
    }
}
