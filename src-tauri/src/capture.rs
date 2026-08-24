use std::{
    fs,
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::Mutex,
};

use tauri::{AppHandle, Manager, State};

use crate::replay_buffer::{
    max_segments,
    prepare_buffer,
    required_segments,
    segment_pattern,
    timestamp,
};

pub struct CaptureState {
    pub process: Mutex<Option<Child>>,
    pub buffer_dir: Mutex<Option<PathBuf>>,
}

fn ffmpeg_path(
    app: &AppHandle,
) -> Result<PathBuf, String> {
    let resource_dir =
        app.path()
            .resource_dir()
            .map_err(|e| {
                format!(
                    "Could not locate resource directory: {e}"
                )
            })?;

    let path =
        resource_dir
            .join("bin")
            .join("ffmpeg.exe");

    if !path.exists() {
        return Err(format!(
            "Bundled FFmpeg not found:\n{}",
            path.display()
        ));
    }

    Ok(path)
}

fn videos_directory(
    app: &AppHandle,
) -> Result<PathBuf, String> {
    app.path()
        .video_dir()
        .map_err(|e| {
            format!(
                "Could not locate Windows Videos folder: {e}"
            )
        })
}

#[tauri::command]
pub fn start_capture(
    app: AppHandle,
    state: State<'_, CaptureState>,
) -> Result<String, String> {
    let mut process =
        state
            .process
            .lock()
            .map_err(|_| {
                "Could not lock capture state."
                    .to_string()
            })?;

    if process.is_some() {
        return Ok(
            "Capture is already running."
                .to_string()
        );
    }

    /*
     * Windows temporary location.
     *
     * We'll replace this with a true RAM
     * buffer after the basic replay system
     * is stable.
     */
    let buffer =
        std::env::temp_dir()
            .join("KoosReplay")
            .join("buffer");

    prepare_buffer(&buffer)?;

    let ffmpeg =
        ffmpeg_path(&app)?;

    let pattern =
        segment_pattern(&buffer)
            .to_string_lossy()
            .to_string();

    let segments =
        max_segments()
            .to_string();

    /*
     * Desktop capture.
     *
     * We explicitly specify:
     *
     * 60 FPS
     * 1920x1080 maximum
     *
     * The resolution can be changed later
     * when hardware detection is implemented.
     */
    let child =
        Command::new(&ffmpeg)
            .args([
                "-hide_banner",

                "-loglevel",
                "error",

                "-f",
                "gdigrab",

                "-framerate",
                "60",

                "-draw_mouse",
                "1",

                "-i",
                "desktop",

                /*
                 * H.264 software encoder for the
                 * compatibility version.
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
                 * Keyframe every second.
                 */
                "-g",
                "60",

                "-keyint_min",
                "60",

                "-sc_threshold",
                "0",

                /*
                 * Rolling MPEG-TS segments.
                 */
                "-f",
                "segment",

                "-segment_time",
                "2",

                "-reset_timestamps",
                "1",

                "-segment_wrap",
                &segments,

                &pattern,
            ])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| {
                format!(
                    "Could not start FFmpeg:\n{e}"
                )
            })?;

    *process =
        Some(child);

    drop(process);

    let mut buffer_state =
        state
            .buffer_dir
            .lock()
            .map_err(|_| {
                "Could not lock buffer state."
                    .to_string()
            })?;

    *buffer_state =
        Some(buffer);

    Ok(
        "KoosReplay capture started."
            .to_string()
    )
}

#[tauri::command]
pub fn stop_capture(
    state: State<'_, CaptureState>,
) -> Result<(), String> {
    let mut process =
        state
            .process
            .lock()
            .map_err(|_| {
                "Could not lock capture state."
                    .to_string()
            })?;

    if let Some(mut child) =
        process.take()
    {
        let _ =
            child.kill();

        let _ =
            child.wait();
    }

    Ok(())
}

#[tauri::command]
pub fn save_replay(
    app: AppHandle,
    state: State<'_, CaptureState>,
    seconds: u64,
) -> Result<String, String> {
    let seconds =
        seconds.clamp(1, 120);

    let buffer =
        state
            .buffer_dir
            .lock()
            .map_err(|_| {
                "Could not lock buffer state."
                    .to_string()
            })?
            .clone()
            .ok_or_else(|| {
                "Capture has not started yet."
                    .to_string()
            })?;

    /*
     * Get completed TS segments.
     */
    let mut segments =
        fs::read_dir(&buffer)
            .map_err(|e| {
                format!(
                    "Could not read replay buffer:\n{e}"
                )
            })?
            .flatten()
            .map(|entry| entry.path())
            .filter(|path| {
                path.extension()
                    .and_then(|x| x.to_str())
                    == Some("ts")
            })
            .collect::<Vec<_>>();

    if segments.is_empty() {
        return Err(
            "The replay buffer is still warming up. \
             Wait a few seconds and press F9 again."
                .to_string()
        );
    }

    /*
     * Sort by filename.
     *
     * FFmpeg creates:
     *
     * segment_00000.ts
     * segment_00001.ts
     * segment_00002.ts
     *
     * so lexical ordering is chronological.
     */
    segments.sort();

    /*
     * Only use completed segments.
     *
     * The newest file may still be written.
     */
    if segments.len() > 1 {
        segments.pop();
    }

    let wanted =
        required_segments(seconds);

    let start =
        segments
            .len()
            .saturating_sub(wanted);

    let selected =
        &segments[start..];

    if selected.is_empty() {
        return Err(
            "Not enough completed footage yet."
                .to_string()
        );
    }

    /*
     * Create concat file.
     */
    let concat =
        buffer.join(
            "replay_concat.txt"
        );

    let mut concat_text =
        String::new();

    for file in selected {
        let path =
            file.to_string_lossy()
                .replace(
                    '\\',
                    "/"
                );

        concat_text.push_str(
            &format!(
                "file '{}'\n",
                path
            )
        );
    }

    fs::write(
        &concat,
        concat_text,
    )
    .map_err(|e| {
        format!(
            "Could not create replay list:\n{e}"
        )
    })?;

    /*
     * Save location:
     *
     * Videos\KoosReplay
     */
    let videos =
        videos_directory(&app)?;

    let output_dir =
        videos.join(
            "KoosReplay"
        );

    fs::create_dir_all(
        &output_dir
    )
    .map_err(|e| {
        format!(
            "Could not create KoosReplay folder:\n{e}"
        )
    })?;

    let output =
        output_dir.join(
            format!(
                "KoosReplay_{}.mp4",
                timestamp()
            )
        );

    let ffmpeg =
        ffmpeg_path(&app)?;

    let concat =
        concat
            .to_string_lossy()
            .to_string();

    let output_string =
        output
            .to_string_lossy()
            .to_string();

    /*
     * Convert the selected TS stream into
     * one normal MP4.
     *
     * We re-mux instead of re-encoding,
     * making the save extremely fast.
     */
    let result =
        Command::new(&ffmpeg)
            .args([
                "-hide_banner",

                "-loglevel",
                "error",

                "-f",
                "concat",

                "-safe",
                "0",

                "-i",
                &concat,

                "-c",
                "copy",

                "-movflags",
                "+faststart",

                &output_string,
            ])
            .output()
            .map_err(|e| {
                format!(
                    "Could not save replay:\n{e}"
                )
            })?;

    let _ =
        fs::remove_file(
            &concat
        );

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

    if !output.exists() {
        return Err(
            "FFmpeg finished but no replay file was created."
                .to_string()
        );
    }

    let size =
        fs::metadata(&output)
            .map_err(|e| {
                format!(
                    "Could not check replay file:\n{e}"
                )
            })?
            .len();

    if size == 0 {
        return Err(
            "The replay file is empty."
                .to_string()
        );
    }

    Ok(
        output
            .to_string_lossy()
            .to_string()
    )
}
