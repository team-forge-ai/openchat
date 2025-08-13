use crate::model_store::{is_model_cached, model_cache_dir, model_downloading_dir};
use hf_download::{DownloadConfig, HfDownloader, ProgressEvent, RepoType};
use log::{debug, error, info, warn};
use serde::Serialize;
use std::path::Path;
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc,
};
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
    info!(
        "ensure_hf_model_cached: starting for {repo_id} -> final_dir={:?} downloading_dir={:?}",
        final_dir, downloading_dir
    );
    if is_model_cached(repo_id) {
        // Best-effort cleanup of any stale ".downloading" directory if the final cache exists.
        if downloading_dir.exists() {
            debug!(
                "ensure_hf_model_cached: removing stale downloading dir for {repo_id}: {:?}",
                downloading_dir
            );
            if let Err(remove_err) = std::fs::remove_dir_all(&downloading_dir) {
                warn!(
                    "ensure_hf_model_cached: failed to remove stale downloading dir for {repo_id}: {:?} - {remove_err}",
                    downloading_dir
                );
            }
        }
        info!("ensure_hf_model_cached: model already cached for {repo_id}");
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

        // Shared counters to compute and log percentage progress without excessive spam
        let total_bytes_to_download = Arc::new(AtomicU64::new(0));
        let downloaded_bytes = Arc::new(AtomicU64::new(0));
        let last_logged_percent = Arc::new(AtomicU64::new(0));

        let total_bytes_to_download_cb = total_bytes_to_download.clone();
        let downloaded_bytes_cb = downloaded_bytes.clone();
        let last_logged_percent_cb = last_logged_percent.clone();

        let progress = move |evt: ProgressEvent| match evt {
            ProgressEvent::RepoDiscovered {
                num_files,
                total_bytes,
            } => {
                total_bytes_to_download_cb.store(total_bytes, Ordering::Relaxed);
                info!(
                    "download[{repo_id_owned}]: discovered repo - files={num_files} total_bytes={total_bytes}"
                );
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
                let total = total_bytes_to_download_cb.load(Ordering::Relaxed);
                if total > 0 {
                    let current = downloaded_bytes_cb.fetch_add(bytes as u64, Ordering::Relaxed) + bytes as u64;
                    let percent = (((current as f64) / (total as f64)) * 100.0).floor() as u64;
                    let last = last_logged_percent_cb.load(Ordering::Relaxed);
                    if percent > last {
                        last_logged_percent_cb.store(percent, Ordering::Relaxed);
                        info!(
                            "download[{repo_id_owned}]: {percent}% ({current}/{total} bytes)"
                        );
                    }
                }
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
                debug!("download[{repo_id_owned}]: file completed - {path}");
                let _ = progress_app.emit(
                    "mlc-download-progress",
                    DownloadProgressPayload::FileCompleted {
                        repo_id: repo_id_owned.clone(),
                        path,
                    },
                );
            }
            ProgressEvent::FileFailed { path, error } => {
                warn!("download[{repo_id_owned}]: file failed - {path} - {error}");
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
                debug!("download[{repo_id_owned}]: file started - {path}");
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

        info!("download[{repo_id_for_download}]: starting blocking download into {:?}", downloading_owned);

        let summary = match downloader.blocking_download_repo(
            &repo_id_for_download,
            RepoType::Model,
            "main",
            Path::new(&downloading_owned),
            progress,
        ) {
            Ok(s) => s,
            Err(e) => {
                error!("download[{repo_id_for_download}]: error during download - {e}");
                return Err(format!("download error: {e}"));
            }
        };

        // Atomically promote the downloading dir to the final cache dir.
        // If the final dir already exists (e.g., previous run completed), clean up the downloading dir.
        if final_owned.exists() {
            debug!("download[{repo_id_for_download}]: final dir already exists. cleaning downloading dir {:?}", downloading_owned);
            if let Err(remove_err) = std::fs::remove_dir_all(&downloading_owned) {
                warn!(
                    "download[{repo_id_for_download}]: failed to remove downloading dir {:?} - {}",
                    downloading_owned, remove_err
                );
            }
        } else {
            debug!(
                "download[{repo_id_for_download}]: promoting downloading dir {:?} -> {:?}",
                downloading_owned, final_owned
            );
            if let Err(rename_err) = std::fs::rename(&downloading_owned, &final_owned) {
                error!(
                    "download[{repo_id_for_download}]: failed to promote downloading dir: {}",
                    rename_err
                );
                return Err(format!("failed to promote downloading dir: {rename_err}"));
            }
        }

        let _ = app_clone.emit(
            "mlc-download-progress",
            DownloadProgressPayload::Completed {
                repo_id: repo_id_for_completed,
                files_downloaded: summary.files_downloaded,
                bytes_downloaded: summary.bytes_downloaded,
            },
        );
        info!(
            "download[{repo_id_for_download}]: completed - files_downloaded={} bytes_downloaded={}",
            summary.files_downloaded, summary.bytes_downloaded
        );
        Ok::<(), String>(())
    })
    .await
    .map_err(|e| {
        error!("ensure_hf_model_cached[{repo_id}]: join error - {e}");
        format!("join error: {e}")
    })??;

    debug!("ensure_hf_model_cached: finished for {repo_id}");
    Ok(())
}
