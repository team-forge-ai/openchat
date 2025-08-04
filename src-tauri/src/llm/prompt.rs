use crate::models::Message;
use qwen3_inference::Tokenizer;

/// Build a ChatML snippet for the most recent user message.
/// If `first_turn` is true we include the system prompt template.
pub fn build_snippet(messages: &[Message], tokenizer: &Tokenizer, first_turn: bool) -> String {
    // Find the last user message (UI always appends user last)
    let user_msg = match messages.iter().rev().find(|m| m.role == "user") {
        Some(m) => &m.content,
        None => return String::new(),
    };

    if first_turn {
        // <system><user>
        tokenizer
            .system_prompt_template
            .replace("%s", &tokenizer.prompt_template.replace("%s", user_msg))
    } else {
        // normal user turn
        tokenizer.prompt_template.replace("%s", user_msg)
    }
}
