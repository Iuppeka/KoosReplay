use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

pub const SEGMENT_SECONDS: u64 = 2;
pub const BUFFER_SECONDS: u64 = 40;

pub fn prepare_buffer(dir: &Path) -> Result<(), String> {
    fs::create_dir_all(dir)
        .map_err(|e| format!("Could not create replay buffer: {e}"))?;

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();

            if path.is_file() {
                let _ = fs::remove_file(path);
            }
        }
    }

    Ok(())
}

pub fn segment_pattern(dir: &Path) -> PathBuf {
    dir.join("segment_%05d.ts")
}

pub fn required_segments(seconds: u64) -> usize {
    let seconds = seconds.clamp(1, 120);

    ((seconds + SEGMENT_SECONDS - 1) / SEGMENT_SECONDS) as usize
}

pub fn max_segments() -> usize {
    (BUFFER_SECONDS / SEGMENT_SECONDS) as usize
}

pub fn timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
