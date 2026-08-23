mod capture;

use capture::CaptureState;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(CaptureState {
            process: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            capture::start_capture,
            capture::stop_capture
        ])
        .run(tauri::generate_context!())
        .expect("error while running KoosReplay");
}
