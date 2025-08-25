use home::home_dir;
use std::fs;
use std::path::{Path, PathBuf};

/// Resolve the OS-specific default Hugging Face hub base directory.
///
/// - macOS: ~/Library/Caches/huggingface/hub
/// - Linux: ~/.cache/huggingface/hub
/// - Windows: %LOCALAPPDATA%\huggingface\hub (fallback: ~/AppData/Local/huggingface/hub)
fn huggingface_hub_base_dir() -> PathBuf {
    #[cfg(target_os = "macos")]
    {
        let base = home_dir().unwrap_or_else(|| PathBuf::from("/"));
        return base
            .join("Library")
            .join("Caches")
            .join("huggingface")
            .join("hub");
    }

    #[cfg(target_os = "linux")]
    {
        let base = home_dir().unwrap_or_else(|| PathBuf::from("/"));
        return base.join(".cache").join("huggingface").join("hub");
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            return PathBuf::from(local_app_data)
                .join("huggingface")
                .join("hub");
        }
        let base = home_dir().unwrap_or_else(|| PathBuf::from("/"));
        return base
            .join("AppData")
            .join("Local")
            .join("huggingface")
            .join("hub");
    }
}

/// Returns the target directory under the Hugging Face hub where the model should live.
/// Example (Linux): ~/.cache/huggingface/hub/mlc-ai/Qwen3-14B-q4f16_1-MLC
pub fn model_cache_dir(repo_id: &str) -> PathBuf {
    let mut path = huggingface_hub_base_dir();
    for segment in repo_id.split('/') {
        path.push(segment);
    }
    path
}

/// Returns a temporary ".downloading" directory for atomic model downloads.
/// We download into this directory first and atomically rename to the final
/// cache directory upon successful completion.
pub fn model_downloading_dir(repo_id: &str) -> PathBuf {
    let mut path = model_cache_dir(repo_id);
    match path.file_name() {
        Some(name_os) => {
            let name = name_os.to_string_lossy();
            path.set_file_name(format!("{name}.downloading"));
            path
        }
        None => {
            // Fallback: append a generic suffix if the file name is missing
            path.join(".downloading")
        }
    }
}

/// Best-effort check whether the model directory exists and contains at least one non-temp file.
pub fn is_model_cached(repo_id: &str) -> bool {
    let dir = model_cache_dir(repo_id);
    if !dir.exists() || !dir.is_dir() {
        return false;
    }
    match fs::read_dir(&dir) {
        Ok(entries) => entries
            .filter_map(Result::ok)
            .map(|e| e.path())
            .any(|p| p.is_file() && !is_temp_part_file(&p)),
        Err(_) => false,
    }
}

fn is_temp_part_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("part"))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_cache_dir() {
        let repo = "mlc-ai/Qwen3-14B-q4f16_1-MLC";
        let dir = model_cache_dir(repo);
        let dir_str = dir.to_string_lossy();
        // Common suffix elements across platforms
        assert!(dir_str.contains("huggingface"));
        assert!(dir_str.contains("hub"));
        assert!(dir_str.contains("mlc-ai"));
        assert!(dir_str.contains("Qwen3-14B-q4f16_1-MLC"));

        #[cfg(target_os = "macos")]
        {
            assert!(dir_str.contains("Library/"));
            assert!(dir_str.contains("Caches"));
        }

        #[cfg(target_os = "linux")]
        {
            assert!(dir_str.contains(".cache"));
        }

        #[cfg(target_os = "windows")]
        {
            // We cannot rely on exact LOCALAPPDATA value in tests, but ensure "huggingface\\hub" is present
            assert!(dir_str.to_lowercase().contains("huggingface"));
            assert!(dir_str.to_lowercase().contains("hub"));
        }
    }
}
