#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod capture;
mod replay_buffer;

use capture::{
    save_replay,
    start_capture,
    stop_capture,
    CaptureState,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        /*
         * Capture state
         */
        .manage(CaptureState {
            process: std::sync::Mutex::new(None),
            buffer_dir: std::sync::Mutex::new(None),
        })

        /*
         * Tauri commands available to App.tsx
         */
        .invoke_handler(
            tauri::generate_handler![
                start_capture,
                stop_capture,
                save_replay
            ]
        )

        /*
         * Start the application.
         */
        .run(tauri::generate_context!())
        .expect(
            "error while running KoosReplay"
        );
}
