use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::State;

pub struct CaptureState {
    pub process: Mutex<Option<Child>>,
}

#[tauri::command]
pub fn start_capture(
    state: State<'_, CaptureState>,
    output_dir: String,
) -> Result<String, String> {
    let mut process = state
        .process
        .lock()
        .map_err(|_| "Failed to lock capture state".to_string())?;

    if process.is_some() {
        return Ok("Capture already running".to_string());
    }

    let output = PathBuf::from(output_dir);

    std::fs::create_dir_all(&output)
        .map_err(|e| format!("Failed to create output directory: {e}"))?;

    /*
     * Initial backend placeholder.
     *
     * The next step will replace this with the bundled FFmpeg
     * replay-buffer command.
     */

    let child = Command::new("ffmpeg")
        .arg("-version")
        .spawn()
        .map_err(|e| {
            format!(
                "FFmpeg is not available yet: {e}"
            )
        })?;

    *process = Some(child);

    Ok("Capture backend started".to_string())
}

#[tauri::command]
pub fn stop_capture(
    state: State<'_, CaptureState>,
) -> Result<(), String> {
    let mut process = state
        .process
        .lock()
        .map_err(|_| "Failed to lock capture state".to_string())?;

    if let Some(mut child) = process.take() {
        let _ = child.kill();
        let _ = child.wait();
    }

    Ok(())
}
