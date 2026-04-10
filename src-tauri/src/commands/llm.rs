use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessagePayload>,
    temperature: f64,
    max_tokens: u32,
}

#[derive(Serialize)]
struct ChatMessagePayload {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct ChatResponse {
    choices: Option<Vec<ChatChoice>>,
    error: Option<serde_json::Value>,
}

#[derive(Deserialize)]
struct ChatChoice {
    message: ChatChoiceMessage,
}

#[derive(Deserialize)]
struct ChatChoiceMessage {
    content: Option<String>,
}

/// 通过 Rust 端 reqwest 代理 LLM API 调用，绕过浏览器 CORS 限制
#[tauri::command]
pub async fn llm_chat(
    base_url: String,
    api_key: String,
    model: String,
    messages: Vec<ChatMessage>,
    temperature: Option<f64>,
    max_tokens: Option<u32>,
) -> Result<String, String> {
    let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));

    let payload = ChatRequest {
        model,
        messages: messages
            .into_iter()
            .map(|m| ChatMessagePayload {
                role: m.role,
                content: m.content,
            })
            .collect(),
        temperature: temperature.unwrap_or(0.3),
        max_tokens: max_tokens.unwrap_or(2048),
    };

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("网络请求失败: {}", e))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| format!("读取响应失败: {}", e))?;

    if !status.is_success() {
        return Err(format!("LLM API 请求失败 ({}): {}", status, body));
    }

    let data: ChatResponse =
        serde_json::from_str(&body).map_err(|e| format!("解析响应失败: {} / 原始: {}", e, body))?;

    if let Some(err) = data.error {
        return Err(format!("LLM API 返回错误: {}", err));
    }

    let content = data
        .choices
        .and_then(|c| c.into_iter().next())
        .and_then(|c| c.message.content)
        .ok_or_else(|| "LLM API 返回了空内容".to_string())?;

    Ok(content)
}

/// 检测 LLM API 是否可用
#[tauri::command]
pub async fn llm_check(base_url: String, api_key: String) -> Result<bool, String> {
    let url = format!("{}/models", base_url.trim_end_matches('/'));

    let client = reqwest::Client::new();
    let result = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await;

    match result {
        Ok(resp) => Ok(resp.status().is_success()),
        Err(_) => Ok(false),
    }
}
