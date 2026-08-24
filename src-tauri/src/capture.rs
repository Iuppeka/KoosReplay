use std::{
    fs,
    path::PathBuf,
    process::{Child, Command, Stdio},
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
        resource_dir
            .join("bin")
            .join("ffmpeg.exe");

    if !path.exists() {
        return Err(format!(
            "Bundled FFmpeg was not found:\n{}",
            path.display()
        ));
    }

    Ok(path)
}

fn output_directory(
    app: &AppHandle,
    requested: &str,
) -> Result<PathBuf, String> {
    let requested =
        PathBuf::from(requested);

    if requested.is_absolute() {
        return Ok(requested);
    }

    let videos =
        app.path()
            .video_dir()
            .map_err(|e| {
                format!(
                    "Could not locate Videos folder: {e}"
                )
            })?;

    let relative =
        requested
            .strip_prefix("Videos")
            .unwrap_or(&requested);

    Ok(videos.join(relative))
}

/*
 * Starts continuous capture.
 *
 * IMPORTANT:
 *
 * We use the Windows TEMP directory for the
 * rolling chunks rather than Videos\KoosReplay.
 *
 * Only the final replay is copied to the user's
 * Videos folder.
 */
#[tauri::command]
pub fn start_capture(
    app: AppHandle,
    state: State<'_, CaptureState>,
    output_dir: String,
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

    let output =
        output_directory(
            &app,
            &output_dir,
        )?;

    fs::create_dir_all(
        &output
    )
    .map_err(|e| {
        format!(
            "Could not create output directory:\n{e}"
        )
    })?;

    /*
     * Use the Windows TEMP directory for
     * the rolling chunks.
     */
    let temp =
        std::env::temp_dir();

    let buffer =
        temp.join("KoosReplay");

    fs::create_dir_all(
        &buffer
    )
    .map_err(|e| {
        format!(
            "Could not create RAM buffer directory:\n{e}"
        )
    })?;

    /*
     * Clean old chunks.
     */
    if let Ok(entries) =
        fs::read_dir(&buffer)
    {
        for entry in entries.flatten() {
            let _ =
                fs::remove_file(
                    entry.path()
                );
        }
    }

    let ffmpeg =
        ffmpeg_path(&app)?;

    let pattern =
        buffer.join(
            "buffer_%05d.mp4"
        );

    let pattern =
        pattern
            .to_string_lossy()
            .to_string();

    /*
     * FFmpeg desktop capture.
     *
     * 60 FPS
     * H.264
     * 2-second chunks
     * 70 chunks maximum
     */
    let child =
        Command::new(ffmpeg)
            .args([
                "-hide_banner",

                "-loglevel",
                "warning",

                /*
                 * Tell FFmpeg exactly what
                 * input we're giving it.
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
                 * First compatibility encoder.
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
                 * One keyframe per second.
                 */
                "-g",
                "60",

                "-keyint_min",
                "60",

                /*
                 * Rolling chunks.
                 */
                "-f",
                "segment",

                "-segment_time",
                "2",

                "-reset_timestamps",
                "1",

                /*
                 * 70 × 2 sec = approximately
                 * 140 seconds.
                 */
                "-segment_wrap",
                "70",

                "-segment_format",
                "mp4",

                &pattern,
            ])
            /*
             * Don't create a console window.
             */
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| {
                format!(
                    "Could not start FFmpeg:\n{e}"
                )
            })?;

    *process =
        Some(child);

    drop(process);

    let mut state_buffer =
        state
            .buffer_dir
            .lock()
            .map_err(|_| {
                "Could not lock buffer state."
                    .to_string()
            })?;

    *state_buffer =
        Some(buffer);

    Ok(
        "RAM replay buffer started."
            .to_string()
    )
}

/*
 * Stop continuous capture.
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
        let _ =
            child.kill();

        let _ =
            child.wait();
    }

    Ok(())
}

/*
 * Save the latest replay.
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
                "KoosReplay is not recording."
                    .to_string()
            })?;

    let output =
        output_directory(
            &app,
            "Videos\\KoosReplay"
        )?;

    fs::create_dir_all(
        &output
    )
    .map_err(|e| {
        format!(
            "Could not create Videos\\KoosReplay:\n{e}"
        )
    })?;

    /*
     * Find completed MP4 chunks.
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
                    == Some("mp4")
            })
            .collect::<Vec<_>>();

    if segments.is_empty() {
        return Err(
            "Replay buffer is still warming up. \
             Wait a few seconds and press F9 again."
                .to_string()
        );
    }

    /*
     * Newest files first by modification time.
     */
    segments.sort_by_key(|path| {
        fs::metadata(path)
            .and_then(|m| {
                m.modified()
            })
            .unwrap_or(
                UNIX_EPOCH
                    .into()
            )
    });

    /*
     * The newest segment may still be
     * receiving data.
     *
     * Don't touch it.
     */
    if segments.len() > 1 {
        segments.pop();
    }

    /*
     * We need approximately:
     *
     * seconds / 2
     *
     * chunks.
     */
    let wanted =
        ((seconds + 1) / 2)
            as usize;

    let start =
        segments
            .len()
            .saturating_sub(
                wanted
            );

    let selected =
        &segments[start..];

    if selected.is_empty() {
        return Err(
            "Not enough completed replay footage yet."
                .to_string()
        );
    }

    /*
     * Build concat file.
     */
    let concat =
        buffer.join(
            "save_concat.txt"
        );

    let mut text =
        String::new();

    for segment in selected {
        let path =
            segment
                .to_string_lossy()
                .replace(
                    '\\',
                    "/"
                )
                .replace(
                    '\'',
                    "'\\''"
                );

        text.push_str(
            &format!(
                "file '{}'\n",
                path
            )
        );
    }

    fs::write(
        &concat,
        text,
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
        output.join(
            filename
        );

    let ffmpeg =
        ffmpeg_path(&app)?;

    let concat =
        concat
            .to_string_lossy()
            .to_string();

    let output =
        output
            .to_string_lossy()
            .to_string();

    /*
     * Join without re-encoding.
     *
     * This makes F9 very fast.
     */
    let result =
        Command::new(ffmpeg)
            .args([
                "-hide_banner",

                "-loglevel",
                "warning",

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

                &output,
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

    /*
     * Make absolutely sure that the
     * output actually exists.
     */
    let metadata =
        fs::metadata(&output)
            .map_err(|e| {
                format!(
                    "Replay wasn't created:\n{e}"
                )
            })?;

    if metadata.len() == 0 {
        return Err(
            "FFmpeg created an empty replay."
                .to_string()
        );
    }

    Ok(output)
}
