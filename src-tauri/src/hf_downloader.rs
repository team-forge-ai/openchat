use crate::model_store::{is_model_cached, model_cache_dir, model_downloading_dir};
use hf_download::{DownloadConfig, HfDownloader, ProgressEvent, RepoType};
use serde::Serialize;
use std::path::Path;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Serialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum DownloadProgressPayload {
    RepoDiscovered {
        repo_id: String,
        num_files: usize,
        total_bytes: u64,
    },
    FileStarted {
        repo_id: String,
        path: String,
        total_bytes: Option<u64>,
    },
    BytesTransferred {
        repo_id: String,
        path: String,
        bytes: u64,
    },
    FileCompleted {
        repo_id: String,
        path: String,
    },
    FileFailed {
        repo_id: String,
        path: String,
        error: String,
    },
    Completed {
        repo_id: String,
        files_downloaded: usize,
        bytes_downloaded: u64,
    },
}

/// Ensure the Hugging Face model is present in the MLC cache directory; if not, download it.
/// Emits `mlc-download-progress` events with a tagged JSON payload for UI progress.
pub async fn ensure_hf_model_cached(app: &AppHandle, repo_id: &str) -> Result<(), String> {
    let final_dir = model_cache_dir(repo_id);
    let downloading_dir = model_downloading_dir(repo_id);
    if is_model_cached(repo_id) {
        // Best-effort cleanup of any stale ".downloading" directory if the final cache exists.
        if downloading_dir.exists() {
            let _ = std::fs::remove_dir_all(&downloading_dir);
        }
        return Ok(());
    }

    let cfg = DownloadConfig::default();
    let downloader = HfDownloader::new(cfg).map_err(|e| format!("hf_download init error: {e}"))?;

    // Create parent dirs for the downloading directory
    if let Some(parent) = downloading_dir.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("failed to create cache parent dir: {e}"))?;
    }
    // Ensure downloading directory exists (resume-friendly)
    std::fs::create_dir_all(&downloading_dir)
        .map_err(|e| format!("failed to create downloading dir: {e}"))?;

    // hf_download currently provides blocking and async; use blocking in a blocking task to avoid holding the async runtime.
    let app_clone = app.clone();
    let repo_id_owned = repo_id.to_string();
    let repo_id_for_completed = repo_id_owned.clone();
    let repo_id_for_download = repo_id.to_string();
    let downloading_owned = downloading_dir.clone();
    let final_owned = final_dir.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let progress_app = app_clone.clone();
        let progress = move |evt: ProgressEvent| match evt {
            ProgressEvent::RepoDiscovered {
                num_files,
                total_bytes,
            } => {
                let _ = progress_app.emit(
                    "mlc-download-progress",
                    DownloadProgressPayload::RepoDiscovered {
                        repo_id: repo_id_owned.clone(),
                        num_files,
                        total_bytes,
                    },
                );
            }
            ProgressEvent::BytesTransferred { path, bytes } => {
                let _ = progress_app.emit(
                    "mlc-download-progress",
                    DownloadProgressPayload::BytesTransferred {
                        repo_id: repo_id_owned.clone(),
                        path,
                        bytes: bytes as u64,
                    },
                );
            }
            ProgressEvent::FileCompleted { path } => {
                let _ = progress_app.emit(
                    "mlc-download-progress",
                    DownloadProgressPayload::FileCompleted {
                        repo_id: repo_id_owned.clone(),
                        path,
                    },
                );
            }
            ProgressEvent::FileFailed { path, error } => {
                let _ = progress_app.emit(
                    "mlc-download-progress",
                    DownloadProgressPayload::FileFailed {
                        repo_id: repo_id_owned.clone(),
                        path,
                        error,
                    },
                );
            }
            ProgressEvent::FileStarted { path, size: _ } => {
                let _ = progress_app.emit(
                    "mlc-download-progress",
                    DownloadProgressPayload::FileStarted {
                        repo_id: repo_id_owned.clone(),
                        path,
                        total_bytes: None,
                    },
                );
            }
        };

        let summary = downloader
            .blocking_download_repo(
                &repo_id_for_download,
                RepoType::Model,
                "main",
                Path::new(&downloading_owned),
                progress,
            )
            .map_err(|e| format!("download error: {e}"))?;

        // Atomically promote the downloading dir to the final cache dir.
        // If the final dir already exists (e.g., previous run completed), clean up the downloading dir.
        if final_owned.exists() {
            let _ = std::fs::remove_dir_all(&downloading_owned);
        } else {
            std::fs::rename(&downloading_owned, &final_owned)
                .map_err(|e| format!("failed to promote downloading dir: {e}"))?;
        }

        let _ = app_clone.emit(
            "mlc-download-progress",
            DownloadProgressPayload::Completed {
                repo_id: repo_id_for_completed,
                files_downloaded: summary.files_downloaded,
                bytes_downloaded: summary.bytes_downloaded,
            },
        );
        Ok::<(), String>(())
    })
    .await
    .map_err(|e| format!("join error: {e}"))??;

    Ok(())
}
