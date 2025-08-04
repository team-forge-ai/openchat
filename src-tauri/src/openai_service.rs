use async_openai::{
    types::{ChatCompletionRequestMessage, ChatCompletionRequestSystemMessage, ChatCompletionRequestUserMessage, CreateChatCompletionRequestArgs, Role},
    Client,
    config::OpenAIConfig,
};
use crate::models::Message;

pub struct OpenAIService {
    client: Client<OpenAIConfig>,
}

impl OpenAIService {
    pub fn new(api_key: String) -> Self {
        let client = Client::with_config(
            OpenAIConfig::new().with_api_key(api_key)
        );
        
        OpenAIService { client }
    }

    #[allow(deprecated)]
    pub async fn send_message(&self, messages: Vec<Message>) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        // Convert our messages to OpenAI format
        let mut openai_messages: Vec<ChatCompletionRequestMessage> = Vec::new();
        
        // Add system message
        openai_messages.push(ChatCompletionRequestMessage::System(
            ChatCompletionRequestSystemMessage {
                role: Role::System,
                content: "You are a helpful AI assistant.".to_string(),
                name: None,
            }
        ));

        // Add conversation messages
        for message in messages {
            match message.role.as_str() {
                "user" => {
                    openai_messages.push(ChatCompletionRequestMessage::User(
                        ChatCompletionRequestUserMessage {
                            role: Role::User,
                            content: async_openai::types::ChatCompletionRequestUserMessageContent::Text(message.content),
                            name: None,
                        }
                    ));
                }
                "assistant" => {
                    openai_messages.push(ChatCompletionRequestMessage::Assistant(
                        async_openai::types::ChatCompletionRequestAssistantMessage {
                            role: Role::Assistant,
                            content: Some(message.content),
                            name: None,
                            tool_calls: None,
                            function_call: None,
                        }
                    ));
                }
                _ => {} // Skip unknown roles
            }
        }

        let request = CreateChatCompletionRequestArgs::default()
            .model("gpt-3.5-turbo")
            .messages(openai_messages)
            .build()?;

        let response = self.client.chat().create(request).await?;

        if let Some(choice) = response.choices.first() {
            if let Some(content) = &choice.message.content {
                return Ok(content.clone());
            }
        }

        Err("No response from OpenAI".into())
    }
}