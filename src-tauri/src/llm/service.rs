use super::{core, prompt};
use crate::models::Message;
use anyhow::{anyhow, Result};
use log::debug;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::task;

pub struct LocalLLMService {
    model_path: PathBuf,
    temperature: f32,
    topp: f32,
}

impl LocalLLMService {
    pub fn new(model_path: PathBuf) -> Self {
        Self {
            model_path,
            temperature: 0.7,
            topp: 0.9,
        }
    }

    pub async fn send_message(&self, messages: Vec<Message>) -> Result<String, anyhow::Error> {
        let core = core::get_core(&self.model_path, self.temperature, self.topp)?;

        // offload heavy compute to blocking thread pool
        let snippet_core = Arc::clone(&core);
        task::spawn_blocking(move || Self::infer_sync(snippet_core, messages))
            .await
            .unwrap()
    }

    fn infer_sync(core: Arc<core::LlmCore>, messages: Vec<Message>) -> Result<String> {
        let tokenizer = &core.tokenizer;

        // Build snippet (only the latest user message)
        let snippet = prompt::build_snippet(
            &messages,
            tokenizer,
            !core.primed.load(std::sync::atomic::Ordering::SeqCst),
        );
        if snippet.is_empty() {
            return Err(anyhow!("No new user message found"));
        }

        // Encode
        let tokens = tokenizer.encode(&snippet);
        if tokens.is_empty() {
            return Err(anyhow!("Encoding produced no tokens"));
        }

        // Prime system prompt only once
        if !core.primed.swap(true, std::sync::atomic::Ordering::SeqCst) {
            core.pos.store(0, std::sync::atomic::Ordering::SeqCst);
        }

        let mut transformer = core.transformer.lock().unwrap();
        let mut sampler = core.sampler.lock().unwrap();

        // Feed prompt tokens except the last
        for &tok in &tokens[..tokens.len() - 1] {
            let pos = core.pos.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            transformer.forward(tok, pos);
        }

        // Start generation
        let mut token = *tokens.last().unwrap();
        let mut response = String::new();
        const MAX_ITER: usize = 512;
        for _ in 0..MAX_ITER {
            let pos = core.pos.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            let logits = transformer.forward(token, pos);
            let mut v = logits.to_vec();
            let next = sampler.sample(&mut v);
            if next == tokenizer.eos_token_id as usize || next == tokenizer.bos_token_id as usize {
                break;
            }
            response.push_str(&tokenizer.decode(next));
            token = next;
            if response.len() > 1000 {
                break;
            }
        }

        Ok(response.trim().to_string())
    }
}
