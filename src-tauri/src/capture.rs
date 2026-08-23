use std::{
    fs,
    path::{Path, PathBuf},
    process::{Child, Command},
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};

use tauri::State;

pub struct CaptureState {
    pub process: Mutex<Option<Child>>,
    pub buffer_dir: Mutex<Option<PathBuf>>,
}

fn ffmpeg_path() -> PathBuf {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(Path::to_path_buf))
        .unwrap_or_else(|| PathBuf::from("."));

    exe_dir.join("ffmpeg.exe")
}

fn timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

#[tauri::command]
pub fn start_capture(
    state: State<'_, CaptureState>,
    output_dir: String,
) -> Result<String, String> {
    let mut process = state
        .process
        .lock()
        .map_err(|_| "Could not lock capture state".to_string())?;

    if process.is_some() {
        return Ok("Capture is already running".to_string());
    }

    let output = PathBuf::from(output_dir);

    fs::create_dir_all(&output)
        .map_err(|e| format!("Could not create output directory: {e}"))?;

    let buffer_dir = output.join(".buffer");

    fs::create_dir_all(&buffer_dir)
        .map_err(|e| format!("Could not create replay buffer: {e}"))?;

    /*
     * Remove old buffer files.
     */
    if let Ok(entries) = fs::read_dir(&buffer_dir) {
        for entry in entries.flatten() {
            let path = entry.path();

            if path.is_file() {
                let _ = fs::remove_file(path);
            }
        }
    }

    let ffmpeg = ffmpeg_path();

    if !ffmpeg.exists() {
        return Err(format!(
            "KoosReplay could not find bundled FFmpeg at:\n{}",
            ffmpeg.display()
        ));
    }

    /*
     * Capture the Windows desktop.
     *
     * We deliberately start with a compatibility capture path.
     * Hardware encoder selection will be added next.
     */
    let segment_pattern = buffer_dir
        .join("segment_%05d.mp4");

    let child = Command::new(&ffmpeg)
        .args([
            "-hide_banner",
            "-loglevel",
            "warning",

            /*
             * Windows desktop capture.
             */
            "-f",
            "gdigrab",

            "-framerate",
            "60",

            "-draw_mouse",
            "1",

            "-i",
            "desktop",

            /*
             * H.264 software encoding for the first
             * compatibility build.
             */
            "-c:v",
            "libx264",

            "-preset",
            "veryfast",

            "-tune",
            "zerolatency",

            "-pix_fmt",
            "yuv420p",

            /*
             * Frequent keyframes make replay segments
             * easier to cut cleanly.
             */
            "-g",
            "60",

            "-keyint_min",
            "60",

            /*
             * Rolling 2-second segments.
             */
            "-f",
            "segment",

            "-segment_time",
            "2",

            "-reset_timestamps",
            "1",

            "-segment_wrap",
            "70",

            /*
             * Keep roughly 140 seconds of segments.
             * KoosReplay will only use the requested
             * 30/60/120 second window when saving.
             */
            "-segment_format",
            "mp4",

            segment_pattern
                .to_string_lossy()
                .as_ref(),
        ])
        .spawn()
        .map_err(|e| {
            format!(
                "Could not start FFmpeg:\n{}",
                e
            )
        })?;

    *process = Some(child);

    let mut buffer = state
        .buffer_dir
        .lock()
        .map_err(|_| "Could not lock buffer state".to_string())?;

    *buffer = Some(buffer_dir);

    Ok("Capture started".to_string())
}

#[tauri::command]
pub fn stop_capture(
    state: State<'_, CaptureState>,
) -> Result<(), String> {
    let mut process = state
        .process
        .lock()
        .map_err(|_| "Could not lock capture state".to_string())?;

    if let Some(mut child) = process.take() {
        let _ = child.kill();
        let _ = child.wait();
    }

    Ok(())
}

#[tauri::command]
pub fn save_replay(
    state: State<'_, CaptureState>,
    seconds: u64,
) -> Result<String, String> {
    if seconds == 0 {
        return Err(
            "Replay duration must be greater than zero."
                .to_string(),
        );
    }

    if seconds > 120 {
        return Err(
            "Maximum replay duration is 120 seconds."
                .to_string(),
        );
    }

    let buffer = state
        .buffer_dir
        .lock()
        .map_err(|_| "Could not lock buffer state".to_string())?
        .clone()
        .ok_or_else(|| {
            "Capture has not been started.".to_string()
        })?;

    let parent = buffer
        .parent()
        .ok_or_else(|| {
            "Invalid replay buffer directory."
                .to_string()
        })?;

    let output_dir = parent;

    fs::create_dir_all(output_dir)
        .map_err(|e| {
            format!(
                "Could not create output directory: {e}"
            )
        })?;

    /*
     * Get the newest segment files.
     */
    let mut segments: Vec<PathBuf> = fs::read_dir(&buffer)
        .map_err(|e| {
            format!(
                "Could not read replay buffer: {e}"
            )
        })?
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| {
            path.extension()
                .and_then(|x| x.to_str())
                == Some("mp4")
        })
        .collect();

    segments.sort();

    if segments.is_empty() {
        return Err(
            "Replay buffer is still empty. Wait a few seconds and try again."
                .to_string(),
        );
    }

    /*
     * Each segment is approximately two seconds.
     */
    let needed_segments =
        ((seconds + 1) / 2) as usize;

    let start =
        segments.len().saturating_sub(needed_segments);

    let selected =
        &segments[start..];

    /*
     * Create a temporary concat file.
     */
    let concat_file =
        buffer.join("replay_concat.txt");

    let mut concat = String::new();

    for segment in selected {
        let escaped =
            segment
                .to_string_lossy()
                .replace('\\', "/")
                .replace('\'', "'\\''");

        concat.push_str(
            &format!(
                "file '{}'\n",
                escaped
            )
        );
    }

    fs::write(
        &concat_file,
        concat,
    )
    .map_err(|e| {
        format!(
            "Could not create concat file: {e}"
        )
    })?;

    let filename =
        format!(
            "KoosReplay_{}.mp4",
            timestamp()
        );

    let output =
        output_dir.join(filename);

    let ffmpeg =
        ffmpeg_path();

    /*
     * Join the replay segments without re-encoding.
     */
    let result =
        Command::new(&ffmpeg)
            .args([
                "-hide_banner",
                "-loglevel",
                "warning",

                "-f",
                "concat",

                "-safe",
                "0",

                "-i",
                concat_file
                    .to_string_lossy()
                    .as_ref(),

                "-c",
                "copy",

                "-movflags",
                "+faststart",

                output
                    .to_string_lossy()
                    .as_ref(),
            ])
            .output()
            .map_err(|e| {
                format!(
                    "Could not save replay: {e}"
                )
            })?;

    let _ =
        fs::remove_file(&concat_file);

    if !result.status.success() {
        let error =
            String::from_utf8_lossy(
                &result.stderr
            );

        return Err(format!(
            "FFmpeg failed while saving replay:\n{}",
            error
        ));
    }

    Ok(
        output
            .to_string_lossy()
            .to_string()
    )
}
