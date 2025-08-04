use anyhow::{anyhow, Result};
use log::debug;
use once_cell::sync::OnceCell;
use qwen3_inference::{Sampler, Tokenizer, Transformer, TransformerBuilder};
use std::path::PathBuf;
use std::sync::{
    atomic::{AtomicBool, AtomicUsize, Ordering},
    Arc, Mutex,
};
use std::time::Instant;

/// Heavy objects that should live for the entire application runtime.
/// Wrapped in `Arc` so they can be shared across async tasks.
pub struct LlmCore {
    pub transformer: Mutex<Box<dyn Transformer + Send>>, // model weights & KV-cache
    pub tokenizer: Tokenizer,                            // stateless
    pub sampler: Mutex<Sampler>,                         // temperature, topp, rng
    pub pos: AtomicUsize,                                // current sequence position
    pub primed: AtomicBool,                              // system prompt injected?
}

impl LlmCore {
    /// Build a new core from the quantised model file on disk.
    pub fn load(model_path: &PathBuf, temperature: f32, topp: f32) -> Result<Self> {
        debug!("Loading transformer from {:?}", model_path);
        let t0 = Instant::now();
        let transformer = TransformerBuilder::new(model_path.to_str().unwrap())
            .build()
            .map_err(|e| anyhow!("Failed to load transformer: {e}"))?;
        debug!("Transformer loaded in {:?}", t0.elapsed());

        let t1 = Instant::now();
        let tokenizer = Tokenizer::new(
            model_path.to_str().unwrap(),
            transformer.get_config().vocab_size,
            false,
        )?;
        debug!("Tokenizer loaded in {:?}", t1.elapsed());

        let sampler = Sampler::new(tokenizer.vocab_size, temperature, topp, 42);

        Ok(Self {
            transformer: Mutex::new(Box::new(transformer)),
            tokenizer,
            sampler: Mutex::new(sampler),
            pos: AtomicUsize::new(0),
            primed: AtomicBool::new(false),
        })
    }
}

/// Global singleton so we only pay model-loading cost once.
static CORE: OnceCell<Arc<LlmCore>> = OnceCell::new();

/// Get the global core, creating it on first call.
pub fn get_core(model_path: &PathBuf, temperature: f32, topp: f32) -> Result<Arc<LlmCore>> {
    CORE.get_or_try_init(|| LlmCore::load(model_path, temperature, topp).map(Arc::new))
        .map(Arc::clone)
}
