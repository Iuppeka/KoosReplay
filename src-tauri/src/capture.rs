use std::{
    fs,
    path::PathBuf,
    process::{Child, Command},
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};

use tauri::{AppHandle, Manager, State};

pub struct CaptureState {
    pub process: Mutex<Option<Child>>,
    pub buffer_dir: Mutex<Option<PathBuf>>,
}

fn timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn ffmpeg_path(app: &AppHandle) -> Result<PathBuf, String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| {
            format!(
                "Could not locate resource directory: {e}"
            )
        })?;

    let path =
        resource_dir.join("bin").join("ffmpeg.exe");

    if !path.exists() {
        return Err(format!(
            "Bundled FFmpeg was not found:\n{}",
            path.display()
        ));
    }

    Ok(path)
}

/*
 * Resolve Videos\KoosReplay properly.
 *
 * If the frontend gives us:
 *
 *     Videos\KoosReplay
 *
 * we turn it into the user's real Windows Videos folder.
 */
fn resolve_output_dir(
    app: &AppHandle,
    requested: &str,
) -> Result<PathBuf, String> {
    let requested_path =
        PathBuf::from(requested);

    if requested_path.is_absolute() {
        return Ok(requested_path);
    }

    let video_dir = app
        .path()
        .video_dir()
        .map_err(|e| {
            format!(
                "Could not locate Windows Videos folder: {e}"
            )
        })?;

    /*
     * The frontend uses Videos\KoosReplay.
     * We only want the KoosReplay part here.
     */
    let relative = requested_path
        .strip_prefix("Videos")
        .unwrap_or(&requested_path);

    Ok(video_dir.join(relative))
}

/*
 * Start the permanent rolling capture.
 *
 * FFmpeg continuously creates approximately
 * 2-second MP4 segments.
 *
 * We keep 70 segments:
 *
 * 70 × 2 seconds ≈ 140 seconds
 *
 * This gives us enough room for a 120-second replay.
 */
#[tauri::command]
pub fn start_capture(
    app: AppHandle,
    state: State<'_, CaptureState>,
    output_dir: String,
) -> Result<String, String> {
    let mut process = state
        .process
        .lock()
        .map_err(|_| {
            "Could not lock capture state.".to_string()
        })?;

    /*
     * Already recording.
     */
    if process.is_some() {
        return Ok(
            "Capture is already running.".to_string()
        );
    }

    let output =
        resolve_output_dir(
            &app,
            &output_dir,
        )?;

    fs::create_dir_all(&output)
        .map_err(|e| {
            format!(
                "Could not create output directory:\n{e}"
            )
        })?;

    let buffer_dir =
        output.join(".buffer");

    fs::create_dir_all(&buffer_dir)
        .map_err(|e| {
            format!(
                "Could not create replay buffer:\n{e}"
            )
        })?;

    /*
     * Delete old buffer files.
     */
    if let Ok(entries) =
        fs::read_dir(&buffer_dir)
    {
        for entry in entries.flatten() {
            let path = entry.path();

            if path.is_file() {
                let _ =
                    fs::remove_file(path);
            }
        }
    }

    let ffmpeg =
        ffmpeg_path(&app)?;

    let segment_pattern =
        buffer_dir.join(
            "segment_%05d.mp4"
        );

    let segment_pattern_string =
        segment_pattern
            .to_string_lossy()
            .to_string();

    /*
     * IMPORTANT:
     *
     * We explicitly specify:
     *
     * 60 FPS
     * H.264
     * 1080p-ish desktop capture
     * 2-second segments
     *
     * The segment muxer continuously records.
     */
    let child =
        Command::new(&ffmpeg)
            .args([
                "-hide_banner",

                /*
                 * Keep FFmpeg quiet unless
                 * something is actually wrong.
                 */
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
                 * Software H.264 for our first
                 * working version.
                 *
                 * We'll replace this with
                 * AMD hardware encoding later.
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
                 * This makes replay segments
                 * easier to join.
                 */
                "-g",
                "60",

                "-keyint_min",
                "60",

                /*
                 * Rolling 2-second MP4 segments.
                 */
                "-f",
                "segment",

                "-segment_time",
                "2",

                "-reset_timestamps",
                "1",

                /*
                 * Keep roughly 140 seconds.
                 */
                "-segment_wrap",
                "70",

                "-segment_format",
                "mp4",

                &segment_pattern_string,
            ])
            .spawn()
            .map_err(|e| {
                format!(
                    "Could not start FFmpeg:\n{e}"
                )
            })?;

    *process = Some(child);

    drop(process);

    let mut buffer =
        state
            .buffer_dir
            .lock()
            .map_err(|_| {
                "Could not lock buffer state."
                    .to_string()
            })?;

    *buffer =
        Some(buffer_dir);

    Ok(
        "KoosReplay is now recording continuously."
            .to_string()
    )
}

/*
 * Stop the background recorder.
 */
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
        /*
         * Terminate FFmpeg.
         */
        let _ =
            child.kill();

        let _ =
            child.wait();
    }

    Ok(())
}

/*
 * Save the latest N seconds.
 *
 * Example:
 *
 *     save_replay(30)
 *
 * means:
 *
 *     take the latest ~30 seconds
 *     from the rolling buffer
 *     and create one MP4.
 */
#[tauri::command]
pub fn save_replay(
    app: AppHandle,
    state: State<'_, CaptureState>,
    seconds: u64,
) -> Result<String, String> {
    if seconds == 0 {
        return Err(
            "Replay duration must be greater than zero."
                .to_string()
        );
    }

    if seconds > 120 {
        return Err(
            "Maximum replay duration is 120 seconds."
                .to_string()
        );
    }

    /*
     * Get the buffer directory.
     */
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
                "KoosReplay is not recording yet."
                    .to_string()
            })?;

    let output_dir =
        buffer
            .parent()
            .ok_or_else(|| {
                "Invalid replay buffer directory."
                    .to_string()
            })?
            .to_path_buf();

    fs::create_dir_all(
        &output_dir
    )
    .map_err(|e| {
        format!(
            "Could not create output directory:\n{e}"
        )
    })?;

    /*
     * Read all MP4 segments.
     */
    let mut segments: Vec<PathBuf> =
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
                    == Some("mp4")
            })
            .collect();

    if segments.is_empty() {
        return Err(
            "The replay buffer is still empty. \
             Wait a few seconds and try F9 again."
                .to_string()
        );
    }

    /*
     * Sort by modification time rather than filename.
     *
     * This is VERY important because FFmpeg wraps
     * segment_00000, segment_00001, etc.
     */
    segments.sort_by_key(|path| {
        fs::metadata(path)
            .and_then(|metadata| {
                metadata.modified()
            })
            .unwrap_or(
                SystemTime::UNIX_EPOCH
            )
    });

    /*
     * The newest segment is usually still being
     * written by FFmpeg.
     *
     * Never include it.
     */
    if segments.len() > 1 {
        segments.pop();
    }

    if segments.is_empty() {
        return Err(
            "The recorder has not completed \
             its first segment yet."
                .to_string()
        );
    }

    /*
     * Each segment is approximately 2 seconds.
     *
     * Add one extra segment so the requested
     * duration is not accidentally too short.
     */
    let needed_segments =
        ((seconds + 1) / 2 + 1)
            as usize;

    let start =
        segments
            .len()
            .saturating_sub(
                needed_segments
            );

    let selected =
        &segments[start..];

    /*
     * Create FFmpeg concat file.
     */
    let concat_file =
        buffer.join(
            "replay_concat.txt"
        );

    let mut concat =
        String::new();

    for segment in selected {
        let path =
            segment
                .to_string_lossy()
                .replace('\\', "/")
                .replace(
                    '\'',
                    "'\\''"
                );

        concat.push_str(
            &format!(
                "file '{}'\n",
                path
            )
        );
    }

    fs::write(
        &concat_file,
        concat,
    )
    .map_err(|e| {
        format!(
            "Could not create replay list:\n{e}"
        )
    })?;

    let filename =
        format!(
            "KoosReplay_{}.mp4",
            timestamp()
        );

    let output =
        output_dir.join(
            filename
        );

    let ffmpeg =
        ffmpeg_path(&app)?;

    let concat_path =
        concat_file
            .to_string_lossy()
            .to_string();

    let output_path =
        output
            .to_string_lossy()
            .to_string();

    /*
     * Join the segments without re-encoding.
     *
     * This makes F9 extremely fast.
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
                &concat_path,

                "-c",
                "copy",

                "-movflags",
                "+faststart",

                &output_path,
            ])
            .output()
            .map_err(|e| {
                format!(
                    "Could not run FFmpeg:\n{e}"
                )
            })?;

    let _ =
        fs::remove_file(
            &concat_file
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

    /*
     * Verify that the file actually exists
     * and isn't empty.
     */
    let metadata =
        fs::metadata(&output)
            .map_err(|e| {
                format!(
                    "Replay was supposedly saved, \
                     but the MP4 could not be found:\n{e}"
                )
            })?;

    if metadata.len() == 0 {
        let _ =
            fs::remove_file(&output);

        return Err(
            "FFmpeg created an empty replay file."
                .to_string()
        );
    }

    Ok(
        output
            .to_string_lossy()
            .to_string()
    )
}
