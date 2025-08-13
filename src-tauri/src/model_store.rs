use home::home_dir;
use std::fs;
use std::path::{Path, PathBuf};

/// Parse an HF URI like `HF://org/repo` or `hf://org/repo` into `org/repo`.
pub fn parse_hf_uri(model_uri: &str) -> Option<String> {
    let (scheme, rest) = model_uri.split_once("://")?;
    if scheme.eq_ignore_ascii_case("hf") {
        if rest.is_empty() {
            None
        } else {
            Some(rest.to_string())
        }
    } else {
        None
    }
}

/// Returns the target directory under the MLC cache where the model should live.
/// Example: ~/.cache/mlc_llm/model_weights/hf/mlc-ai/Qwen3-14B-q4f16_1-MLC
pub fn model_cache_dir(repo_id: &str) -> PathBuf {
    let base = home_dir().unwrap_or_else(|| PathBuf::from("/"));
    let mut path = base
        .join(".cache")
        .join("mlc_llm")
        .join("model_weights")
        .join("hf");
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
    fn parse_variants() {
        assert_eq!(
            parse_hf_uri("HF://mlc-ai/Qwen3"),
            Some("mlc-ai/Qwen3".to_string())
        );
        assert_eq!(parse_hf_uri("hf://org/repo"), Some("org/repo".to_string()));
        assert_eq!(parse_hf_uri("file:///tmp/foo"), None);
        assert_eq!(parse_hf_uri("mlc-ai/Qwen3"), None);
    }

    #[test]
    fn builds_cache_dir() {
        let repo = "mlc-ai/Qwen3-14B-q4f16_1-MLC";
        let dir = model_cache_dir(repo);
        let dir_str = dir.to_string_lossy();
        assert!(dir_str.contains(".cache"));
        assert!(dir_str.contains("mlc_llm"));
        assert!(dir_str.contains("model_weights"));
        assert!(dir_str.contains("hf"));
        assert!(dir_str.contains("mlc-ai"));
        assert!(dir_str.contains("Qwen3-14B-q4f16_1-MLC"));
    }
}
