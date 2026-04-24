use serde_json::Value;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tokio::process::Command;

use crate::commands::image::build_replicate_body;
use crate::commands::providers::{build_kling_jwt, normalize_b64};

/// 图生视频统一入口。
///
/// payload 字段约定：
///   prompt                   正向 prompt
///   base_image_b64           参考图 base64（可含 data: 前缀）
///   aspect_ratio             "9:16" | "16:9" | "1:1"
///   duration_s               时长（秒），各厂商取值集见 presets.ts
///   negative_prompt          负向描述，可空
///   secret_key               仅 Kling：SK（AK 走 api_key 字段）
///
/// 返回值（不再是裸 operation_name）：
///   { "provider": "...", "task_id": "...", "extra": { ... } }
///   extra 里可以带 vendor 特有的轮询所需字段（例如 Kling 的 AK/SK 都在 extra，不重发）
#[tauri::command]
pub async fn video_generate_start(
    provider: String,
    api_url: String,
    api_key: String,
    model: String,
    payload: Value,
) -> Result<Value, String> {
    let task_id = match provider.as_str() {
        "gemini" => gemini_start(&api_url, &api_key, &model, &payload).await?,
        "jimeng" => jimeng_start(&api_url, &api_key, &model, &payload).await?,
        "kling" => kling_start(&api_url, &api_key, &model, &payload).await?,
        "minimax" => minimax_start(&api_url, &api_key, &model, &payload).await?,
        "vidu" => vidu_start(&api_url, &api_key, &model, &payload).await?,
        "replicate" => replicate_video_start(&api_url, &api_key, &model, &payload).await?,
        "comfyui" => comfyui_video_start(&api_url, &payload).await?,
        other => return Err(format!("未知视频生成 Provider: {}", other)),
    };
    Ok(serde_json::json!({
        "provider": provider,
        "task_id": task_id,
    }))
}

// ========= Gemini Veo =========

async fn gemini_start(
    api_url: &str,
    api_key: &str,
    model: &str,
    payload: &Value,
) -> Result<String, String> {
    let prompt = payload
        .get("prompt")
        .and_then(|v| v.as_str())
        .ok_or("缺少 prompt 字段")?
        .to_string();
    let base_image_b64 = payload
        .get("base_image_b64")
        .and_then(|v| v.as_str())
        .ok_or("缺少 base_image_b64 字段")?;
    let aspect_ratio = payload
        .get("aspect_ratio")
        .and_then(|v| v.as_str())
        .unwrap_or("9:16")
        .to_string();
    let duration_s = payload
        .get("duration_s")
        .and_then(|v| v.as_u64())
        .unwrap_or(4);
    let negative_prompt = payload
        .get("negative_prompt")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let base = api_url.trim_end_matches('/');
    let url = format!("{}/models/{}:predictLongRunning", base, model);

    let mut instance = serde_json::json!({
        "prompt": prompt,
        "image": {
            "bytesBase64Encoded": normalize_b64(base_image_b64),
            "mimeType": "image/png"
        }
    });
    if !negative_prompt.is_empty() {
        instance["negativePrompt"] = Value::String(negative_prompt.to_string());
    }

    let body = serde_json::json!({
        "instances": [instance],
        "parameters": {
            "aspectRatio": aspect_ratio,
            "durationSeconds": duration_s,
            "sampleCount": 1
        }
    });

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .header("x-goog-api-key", api_key)
        .header("Content-Type", "application/json")
        .timeout(Duration::from_secs(60))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Veo 提交失败: {}", e))?;

    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("读取响应失败: {}", e))?;
    if !status.is_success() {
        return Err(format!("Veo 提交失败 ({}): {}", status, text));
    }

    let raw: Value = serde_json::from_str(&text)
        .map_err(|e| format!("解析 Veo 响应失败: {} / 原始: {}", e, text))?;
    let name = raw
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or_else(|| format!("Veo 响应缺少 name 字段: {}", text))?
        .to_string();
    Ok(name)
}

// ========= 即梦 Seedance i2v =========
// 端点: POST /contents/generations/tasks（Ark 接口）

async fn jimeng_start(
    api_url: &str,
    api_key: &str,
    model: &str,
    payload: &Value,
) -> Result<String, String> {
    let prompt = payload
        .get("prompt")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let base_image_b64 = payload
        .get("base_image_b64")
        .and_then(|v| v.as_str())
        .ok_or("缺少 base_image_b64")?;
    let aspect_ratio = payload
        .get("aspect_ratio")
        .and_then(|v| v.as_str())
        .unwrap_or("9:16");
    let duration_s = payload
        .get("duration_s")
        .and_then(|v| v.as_u64())
        .unwrap_or(5);

    let base = api_url.trim_end_matches('/');
    let url = format!("{}/contents/generations/tasks", base);

    let mut content = vec![serde_json::json!({
        "type": "image_url",
        "image_url": {
            "url": format!("data:image/png;base64,{}", normalize_b64(base_image_b64))
        }
    })];
    if !prompt.is_empty() {
        content.insert(0, serde_json::json!({
            "type": "text",
            "text": prompt,
        }));
    }

    let body = serde_json::json!({
        "model": model,
        "content": content,
        "resolution": "720p",
        "ratio": aspect_ratio,
        "duration": duration_s,
    });

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .timeout(Duration::from_secs(60))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("即梦 Seedance 提交失败: {}", e))?;

    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("读取响应失败: {}", e))?;
    if !status.is_success() {
        return Err(format!("Seedance 提交失败 ({}): {}", status, text));
    }
    let raw: Value = serde_json::from_str(&text)
        .map_err(|e| format!("解析 Seedance 响应失败: {} / 原始: {}", e, text))?;
    let id = raw
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| format!("Seedance 未返回 id: {}", text))?
        .to_string();
    Ok(id)
}

// ========= 可灵 Kling i2v =========
// POST /v1/videos/image2video

async fn kling_start(
    api_url: &str,
    api_key: &str,
    model: &str,
    payload: &Value,
) -> Result<String, String> {
    let secret = payload
        .get("secret_key")
        .and_then(|v| v.as_str())
        .ok_or("Kling 缺少 secret_key")?;
    let token = build_kling_jwt(api_key, secret)?;

    let prompt = payload.get("prompt").and_then(|v| v.as_str()).unwrap_or("");
    let negative = payload
        .get("negative_prompt")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let base_image_b64 = payload
        .get("base_image_b64")
        .and_then(|v| v.as_str())
        .ok_or("缺少 base_image_b64")?;
    let duration_s = payload
        .get("duration_s")
        .and_then(|v| v.as_u64())
        .unwrap_or(5);
    let aspect_ratio = payload
        .get("aspect_ratio")
        .and_then(|v| v.as_str())
        .unwrap_or("9:16");

    let base = api_url.trim_end_matches('/');
    let url = format!("{}/v1/videos/image2video", base);

    let mut body = serde_json::json!({
        "model_name": model,
        "image": normalize_b64(base_image_b64),
        "mode": "std",
        "duration": duration_s.to_string(),
        "aspect_ratio": aspect_ratio,
        "cfg_scale": 0.5,
    });
    if !prompt.is_empty() {
        body["prompt"] = Value::String(prompt.into());
    }
    if !negative.is_empty() {
        body["negative_prompt"] = Value::String(negative.into());
    }

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .timeout(Duration::from_secs(60))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Kling 提交失败: {}", e))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("读取响应失败: {}", e))?;
    if !status.is_success() {
        return Err(format!("Kling 视频提交失败 ({}): {}", status, text));
    }
    let raw: Value = serde_json::from_str(&text)
        .map_err(|e| format!("解析 Kling 响应失败: {} / 原始: {}", e, text))?;
    let task_id = raw
        .pointer("/data/task_id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| format!("Kling 未返回 task_id: {}", text))?
        .to_string();
    Ok(task_id)
}

// ========= MiniMax 海螺 =========
// POST /v1/video_generation

async fn minimax_start(
    api_url: &str,
    api_key: &str,
    model: &str,
    payload: &Value,
) -> Result<String, String> {
    let prompt = payload.get("prompt").and_then(|v| v.as_str()).unwrap_or("");
    let base_image_b64 = payload
        .get("base_image_b64")
        .and_then(|v| v.as_str())
        .ok_or("缺少 base_image_b64")?;

    let base = api_url.trim_end_matches('/');
    let url = format!("{}/v1/video_generation", base);

    let body = serde_json::json!({
        "model": model,
        "prompt": prompt,
        "first_frame_image": format!("data:image/png;base64,{}", normalize_b64(base_image_b64)),
    });

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .timeout(Duration::from_secs(60))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("MiniMax 视频提交失败: {}", e))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("读取响应失败: {}", e))?;
    if !status.is_success() {
        return Err(format!("MiniMax 视频提交失败 ({}): {}", status, text));
    }
    let raw: Value = serde_json::from_str(&text)
        .map_err(|e| format!("解析 MiniMax 响应失败: {} / 原始: {}", e, text))?;

    if let Some(code) = raw.pointer("/base_resp/status_code").and_then(|v| v.as_i64()) {
        if code != 0 {
            return Err(format!("MiniMax 视频失败: {}", raw));
        }
    }
    let task_id = raw
        .get("task_id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| format!("MiniMax 未返回 task_id: {}", text))?
        .to_string();
    Ok(task_id)
}

// ========= Vidu =========
// POST /ent/v2/img2video

async fn vidu_start(
    api_url: &str,
    api_key: &str,
    model: &str,
    payload: &Value,
) -> Result<String, String> {
    let prompt = payload.get("prompt").and_then(|v| v.as_str()).unwrap_or("");
    let base_image_b64 = payload
        .get("base_image_b64")
        .and_then(|v| v.as_str())
        .ok_or("缺少 base_image_b64")?;
    let duration_s = payload
        .get("duration_s")
        .and_then(|v| v.as_u64())
        .unwrap_or(4);

    let base = api_url.trim_end_matches('/');
    let url = format!("{}/ent/v2/img2video", base);

    let body = serde_json::json!({
        "model": model,
        "images": [format!("data:image/png;base64,{}", normalize_b64(base_image_b64))],
        "prompt": prompt,
        "duration": duration_s,
        "resolution": "720p",
    });

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .timeout(Duration::from_secs(60))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Vidu 提交失败: {}", e))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("读取响应失败: {}", e))?;
    if !status.is_success() {
        return Err(format!("Vidu 提交失败 ({}): {}", status, text));
    }
    let raw: Value = serde_json::from_str(&text)
        .map_err(|e| format!("解析 Vidu 响应失败: {} / 原始: {}", e, text))?;
    let task_id = raw
        .get("task_id")
        .and_then(|v| v.as_str())
        .or_else(|| raw.pointer("/data/task_id").and_then(|v| v.as_str()))
        .ok_or_else(|| format!("Vidu 未返回 task_id: {}", text))?
        .to_string();
    Ok(task_id)
}

// ========= Replicate =========
// POST /v1/predictions（Authorization: Token <key>）
// 视频模型输入格式高度依赖具体 model（HunyuanVideo / Mochi-1 / CogVideoX 各家不同）
// 这里只按通用字段 {prompt, aspect_ratio, image?} 组装；用户可在 payload 里塞更多字段透传

async fn replicate_video_start(
    api_url: &str,
    api_key: &str,
    model: &str,
    payload: &Value,
) -> Result<String, String> {
    let prompt = payload
        .get("prompt")
        .and_then(|v| v.as_str())
        .ok_or("缺少 prompt 字段")?
        .to_string();
    let aspect_ratio = payload
        .get("aspect_ratio")
        .and_then(|v| v.as_str())
        .unwrap_or("9:16");
    let duration_s = payload.get("duration_s").and_then(|v| v.as_u64());
    let raw_version = payload
        .get("replicate_video_version")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .unwrap_or(model)
        .to_string();

    let mut input = serde_json::json!({
        "prompt": prompt,
        "aspect_ratio": aspect_ratio,
    });
    if let Some(d) = duration_s {
        input["duration"] = Value::from(d);
    }
    if let Some(img) = payload.get("base_image_b64").and_then(|v| v.as_str()) {
        input["image"] = Value::String(format!(
            "data:image/png;base64,{}",
            normalize_b64(img)
        ));
    }

    let base = api_url.trim_end_matches('/');
    let submit_url = format!("{}/v1/predictions", base);
    let body = build_replicate_body(&raw_version, input);

    let client = reqwest::Client::new();
    let resp = client
        .post(&submit_url)
        .header("Authorization", format!("Token {}", api_key))
        .header("Content-Type", "application/json")
        .timeout(Duration::from_secs(60))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Replicate 视频提交失败: {}", e))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("读取响应失败: {}", e))?;
    if !status.is_success() {
        return Err(format!("Replicate 视频提交失败 ({}): {}", status, text));
    }
    let raw: Value = serde_json::from_str(&text)
        .map_err(|e| format!("解析 Replicate 响应失败: {} / 原始: {}", e, text))?;
    let id = raw
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| format!("Replicate 未返回 id: {}", text))?
        .to_string();
    Ok(id)
}

// ========= 轮询：按 provider 分发 =========

/// 返回 { done, video_uri?, error? }
/// 其中 video_uri 已经是可直接下载的 URL（MiniMax 在此步完成 file retrieve）
#[tauri::command]
pub async fn video_poll_operation(
    provider: String,
    api_url: String,
    api_key: String,
    task_id: String,
    extra: Option<Value>,
) -> Result<Value, String> {
    match provider.as_str() {
        "gemini" => gemini_poll(&api_url, &api_key, &task_id).await,
        "jimeng" => jimeng_poll(&api_url, &api_key, &task_id).await,
        "kling" => {
            let secret = extra
                .as_ref()
                .and_then(|e| e.get("secret_key"))
                .and_then(|v| v.as_str())
                .ok_or("Kling 轮询缺少 secret_key")?;
            kling_poll(&api_url, &api_key, secret, &task_id).await
        }
        "minimax" => minimax_poll(&api_url, &api_key, &task_id).await,
        "vidu" => vidu_poll(&api_url, &api_key, &task_id).await,
        "replicate" => replicate_poll(&api_url, &api_key, &task_id).await,
        "comfyui" => comfyui_video_poll(&api_url, &task_id).await,
        other => Err(format!("未知视频 Provider: {}", other)),
    }
}

async fn gemini_poll(api_url: &str, api_key: &str, operation_name: &str) -> Result<Value, String> {
    let base = api_url.trim_end_matches('/');
    let url = format!("{}/{}", base, operation_name.trim_start_matches('/'));
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .header("x-goog-api-key", api_key)
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("Veo 轮询网络失败: {}", e))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("读取轮询响应失败: {}", e))?;
    if !status.is_success() {
        return Err(format!("Veo 轮询失败 ({}): {}", status, text));
    }
    let raw: Value = serde_json::from_str(&text)
        .map_err(|e| format!("解析轮询响应失败: {} / 原始: {}", e, text))?;
    let done = raw.get("done").and_then(|v| v.as_bool()).unwrap_or(false);
    if !done {
        return Ok(serde_json::json!({ "done": false }));
    }
    if let Some(err) = raw.get("error") {
        return Ok(serde_json::json!({ "done": true, "error": err.to_string() }));
    }
    let video_uri = raw
        .pointer("/response/generateVideoResponse/generatedSamples/0/video/uri")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or_else(|| {
            raw.pointer("/response/generatedVideos/0/video/uri")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        });
    match video_uri {
        Some(uri) => Ok(serde_json::json!({ "done": true, "video_uri": uri })),
        None => Ok(serde_json::json!({
            "done": true,
            "error": format!("完成但无 video uri: {}", text)
        })),
    }
}

async fn jimeng_poll(api_url: &str, api_key: &str, task_id: &str) -> Result<Value, String> {
    let base = api_url.trim_end_matches('/');
    let url = format!("{}/contents/generations/tasks/{}", base, task_id);
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("Seedance 轮询失败: {}", e))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("读取响应失败: {}", e))?;
    if !status.is_success() {
        return Err(format!("Seedance 轮询失败 ({}): {}", status, text));
    }
    let raw: Value = serde_json::from_str(&text)
        .map_err(|e| format!("解析响应失败: {}", e))?;
    let state = raw.get("status").and_then(|v| v.as_str()).unwrap_or("");
    match state {
        "succeeded" => {
            let uri = raw
                .pointer("/content/video_url")
                .and_then(|v| v.as_str())
                .ok_or_else(|| format!("Seedance 完成但无 video_url: {}", text))?;
            Ok(serde_json::json!({ "done": true, "video_uri": uri }))
        }
        "failed" | "cancelled" => Ok(serde_json::json!({
            "done": true,
            "error": raw.get("error").map(|e| e.to_string()).unwrap_or_else(|| text.clone())
        })),
        _ => Ok(serde_json::json!({ "done": false })),
    }
}

async fn kling_poll(
    api_url: &str,
    access_key: &str,
    secret_key: &str,
    task_id: &str,
) -> Result<Value, String> {
    let token = build_kling_jwt(access_key, secret_key)?;
    let base = api_url.trim_end_matches('/');
    let url = format!("{}/v1/videos/image2video/{}", base, task_id);
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("Kling 轮询失败: {}", e))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("读取响应失败: {}", e))?;
    if !status.is_success() {
        return Err(format!("Kling 轮询失败 ({}): {}", status, text));
    }
    let raw: Value = serde_json::from_str(&text)
        .map_err(|e| format!("解析响应失败: {}", e))?;
    let state = raw.pointer("/data/task_status").and_then(|v| v.as_str()).unwrap_or("");
    match state {
        "succeed" => {
            let uri = raw
                .pointer("/data/task_result/videos/0/url")
                .and_then(|v| v.as_str())
                .ok_or_else(|| format!("Kling 完成但无 url: {}", text))?;
            Ok(serde_json::json!({ "done": true, "video_uri": uri }))
        }
        "failed" => Ok(serde_json::json!({
            "done": true,
            "error": raw.pointer("/data/task_status_msg").map(|v| v.to_string()).unwrap_or_else(|| text.clone())
        })),
        _ => Ok(serde_json::json!({ "done": false })),
    }
}

async fn minimax_poll(api_url: &str, api_key: &str, task_id: &str) -> Result<Value, String> {
    let base = api_url.trim_end_matches('/');
    let query_url = format!("{}/v1/query/video_generation?task_id={}", base, task_id);
    let client = reqwest::Client::new();
    let resp = client
        .get(&query_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("MiniMax 查询失败: {}", e))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("读取响应失败: {}", e))?;
    if !status.is_success() {
        return Err(format!("MiniMax 查询失败 ({}): {}", status, text));
    }
    let raw: Value = serde_json::from_str(&text)
        .map_err(|e| format!("解析响应失败: {}", e))?;
    let state = raw.get("status").and_then(|v| v.as_str()).unwrap_or("");
    match state {
        "Success" => {
            let file_id = raw
                .get("file_id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| format!("MiniMax 完成但缺 file_id: {}", text))?;
            // 再调 /files/retrieve 拿下载 URL
            let retrieve_url = format!("{}/v1/files/retrieve?file_id={}", base, file_id);
            let fresp = client
                .get(&retrieve_url)
                .header("Authorization", format!("Bearer {}", api_key))
                .timeout(Duration::from_secs(15))
                .send()
                .await
                .map_err(|e| format!("MiniMax retrieve 失败: {}", e))?;
            let ftext = fresp.text().await.map_err(|e| format!("读取 retrieve 响应失败: {}", e))?;
            let fraw: Value = serde_json::from_str(&ftext)
                .map_err(|e| format!("解析 retrieve 响应失败: {}", e))?;
            let uri = fraw
                .pointer("/file/download_url")
                .and_then(|v| v.as_str())
                .ok_or_else(|| format!("retrieve 无 download_url: {}", ftext))?;
            Ok(serde_json::json!({ "done": true, "video_uri": uri }))
        }
        "Fail" | "Failed" => Ok(serde_json::json!({ "done": true, "error": text })),
        _ => Ok(serde_json::json!({ "done": false })),
    }
}

async fn vidu_poll(api_url: &str, api_key: &str, task_id: &str) -> Result<Value, String> {
    let base = api_url.trim_end_matches('/');
    let url = format!("{}/ent/v2/tasks/{}/creations", base, task_id);
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("Vidu 轮询失败: {}", e))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("读取响应失败: {}", e))?;
    if !status.is_success() {
        return Err(format!("Vidu 轮询失败 ({}): {}", status, text));
    }
    let raw: Value = serde_json::from_str(&text)
        .map_err(|e| format!("解析响应失败: {}", e))?;
    let state = raw.get("state").and_then(|v| v.as_str()).unwrap_or("");
    match state {
        "success" => {
            let uri = raw
                .pointer("/creations/0/url")
                .and_then(|v| v.as_str())
                .ok_or_else(|| format!("Vidu 完成但无 url: {}", text))?;
            Ok(serde_json::json!({ "done": true, "video_uri": uri }))
        }
        "failed" => Ok(serde_json::json!({ "done": true, "error": text })),
        _ => Ok(serde_json::json!({ "done": false })),
    }
}

async fn replicate_poll(api_url: &str, api_key: &str, task_id: &str) -> Result<Value, String> {
    let base = api_url.trim_end_matches('/');
    let url = format!("{}/v1/predictions/{}", base, task_id);
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .header("Authorization", format!("Token {}", api_key))
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("Replicate 轮询失败: {}", e))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("读取响应失败: {}", e))?;
    if !status.is_success() {
        return Err(format!("Replicate 轮询失败 ({}): {}", status, text));
    }
    let raw: Value = serde_json::from_str(&text)
        .map_err(|e| format!("解析响应失败: {}", e))?;
    let state = raw.get("status").and_then(|v| v.as_str()).unwrap_or("");
    match state {
        "succeeded" => {
            let output = raw
                .get("output")
                .ok_or_else(|| format!("Replicate 完成但无 output: {}", text))?;
            let uri = extract_replicate_video_url(output)
                .ok_or_else(|| format!("Replicate output 形状不认识: {}", output))?;
            Ok(serde_json::json!({ "done": true, "video_uri": uri }))
        }
        "failed" | "canceled" => Ok(serde_json::json!({
            "done": true,
            "error": raw.get("error").map(|e| e.to_string()).unwrap_or_else(|| text.clone())
        })),
        _ => Ok(serde_json::json!({ "done": false })),
    }
}

// ========= ComfyUI 本地 =========
// POST {url}/prompt 提交工作流 → 轮询 /history/{prompt_id} → /view 下载
// workflow_json 由前端完整构造并注入占位符

async fn comfyui_video_start(api_url: &str, payload: &Value) -> Result<String, String> {
    let workflow_raw = payload
        .get("workflow_json")
        .and_then(|v| v.as_str())
        .ok_or("ComfyUI 缺少 workflow_json 字段")?;
    let workflow: Value = serde_json::from_str(workflow_raw)
        .map_err(|e| format!("ComfyUI workflow_json 不是合法 JSON: {}", e))?;

    let base = api_url.trim_end_matches('/');
    let url = format!("{}/prompt", base);
    let body = serde_json::json!({ "prompt": workflow });

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .header("Content-Type", "application/json")
        .timeout(Duration::from_secs(30))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("ComfyUI 提交失败: {}（请确认 {} 已启动）", e, base))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("读取响应失败: {}", e))?;
    if !status.is_success() {
        return Err(format!("ComfyUI 视频提交失败 ({}): {}", status, text));
    }
    let raw: Value = serde_json::from_str(&text)
        .map_err(|e| format!("解析 ComfyUI 响应失败: {} / 原始: {}", e, text))?;
    let prompt_id = raw
        .get("prompt_id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| format!("ComfyUI 未返回 prompt_id: {}", text))?
        .to_string();
    Ok(prompt_id)
}

async fn comfyui_video_poll(api_url: &str, prompt_id: &str) -> Result<Value, String> {
    let base = api_url.trim_end_matches('/');
    let url = format!("{}/history/{}", base, prompt_id);
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("ComfyUI 轮询失败: {}", e))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("读取响应失败: {}", e))?;
    if !status.is_success() {
        return Err(format!("ComfyUI 轮询失败 ({}): {}", status, text));
    }
    let raw: Value = serde_json::from_str(&text)
        .map_err(|e| format!("解析响应失败: {}", e))?;

    // /history/{id} 未完成时返回 {} 空对象
    let entry = match raw.get(prompt_id) {
        Some(v) => v,
        None => return Ok(serde_json::json!({ "done": false })),
    };
    if let Some(completed) = entry.pointer("/status/completed").and_then(|v| v.as_bool()) {
        if !completed {
            if let Some(msgs) = entry.pointer("/status/messages").and_then(|v| v.as_array()) {
                for m in msgs {
                    if m.get(0).and_then(|v| v.as_str()) == Some("execution_error") {
                        return Ok(serde_json::json!({
                            "done": true,
                            "error": format!("ComfyUI 节点执行失败: {}", m)
                        }));
                    }
                }
            }
            return Ok(serde_json::json!({ "done": false }));
        }
    }
    let outputs = match entry.get("outputs") {
        Some(o) => o,
        None => return Ok(serde_json::json!({ "done": false })),
    };
    match extract_comfyui_video_file(outputs) {
        Some(uri) => Ok(serde_json::json!({ "done": true, "video_uri": uri })),
        None => Ok(serde_json::json!({
            "done": true,
            "error": format!(
                "ComfyUI 完成但未找到视频输出节点（检查工作流是否含 VHS_VideoCombine）: {}",
                outputs
            )
        })),
    }
}

/// 从 outputs 里找视频文件。VHS_VideoCombine 输出键是 `gifs`（即使是 mp4）；
/// 某些自定义节点用 `videos`；最后兜底检查 `images` 数组里后缀是否为视频
fn extract_comfyui_video_file(outputs: &Value) -> Option<String> {
    let nodes = outputs.as_object()?;
    for (_node_id, node) in nodes {
        for key in ["gifs", "videos", "images"].iter() {
            if let Some(arr) = node.get(*key).and_then(|v| v.as_array()) {
                for item in arr {
                    let filename = item.get("filename").and_then(|v| v.as_str())?;
                    if *key == "images" {
                        let lower = filename.to_lowercase();
                        let is_video = lower.ends_with(".mp4")
                            || lower.ends_with(".webm")
                            || lower.ends_with(".mov")
                            || lower.ends_with(".gif");
                        if !is_video {
                            continue;
                        }
                    }
                    let subfolder = item.get("subfolder").and_then(|v| v.as_str()).unwrap_or("");
                    let ftype = item.get("type").and_then(|v| v.as_str()).unwrap_or("output");
                    return Some(format!("comfyui:{}::{}::{}", filename, subfolder, ftype));
                }
            }
        }
    }
    None
}

/// Replicate 视频 output 形状：单字符串 URL / 字符串数组 / 对象 {video}
fn extract_replicate_video_url(output: &Value) -> Option<String> {
    if let Some(s) = output.as_str() {
        return Some(s.to_string());
    }
    if let Some(arr) = output.as_array() {
        if let Some(s) = arr.iter().find_map(|v| v.as_str()) {
            return Some(s.to_string());
        }
    }
    if let Some(s) = output.get("video").and_then(|v| v.as_str()) {
        return Some(s.to_string());
    }
    if let Some(s) = output.get("url").and_then(|v| v.as_str()) {
        return Some(s.to_string());
    }
    None
}

// ========= 下载产物 =========

/// 下载视频 URL 到角色目录。鉴权方式按 provider 分：
///   gemini → 加 x-goog-api-key 头
///   comfyui → video_uri 形如 `comfyui:filename::subfolder::type`，解析后调 {api_url}/view
///   其他 → 预签名 URL 可直连
#[tauri::command]
pub async fn video_download_to_character(
    app: AppHandle,
    provider: String,
    api_url: String,
    api_key: String,
    video_uri: String,
    character_id: String,
    relative_path: String,
) -> Result<String, String> {
    ensure_safe_relative(&relative_path)?;
    let dest = characters_root(&app)?
        .join(&character_id)
        .join(&relative_path);
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
    }

    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(10))
        .timeout(Duration::from_secs(240))
        .build()
        .map_err(|e| format!("构建 HTTP 客户端失败: {}", e))?;

    let resp = if provider == "comfyui" || video_uri.starts_with("comfyui:") {
        let rest = video_uri.trim_start_matches("comfyui:");
        let parts: Vec<&str> = rest.split("::").collect();
        if parts.is_empty() {
            return Err(format!("ComfyUI video_uri 形如 comfyui:filename::subfolder::type, 实际: {}", video_uri));
        }
        let filename = parts[0];
        let subfolder = parts.get(1).copied().unwrap_or("");
        let ftype = parts.get(2).copied().unwrap_or("output");
        let base = api_url.trim_end_matches('/');
        let url = format!("{}/view", base);
        client
            .get(&url)
            .query(&[
                ("filename", filename),
                ("subfolder", subfolder),
                ("type", ftype),
            ])
            .send()
            .await
            .map_err(|e| format!("ComfyUI 下载视频失败: {}", e))?
    } else {
        let mut req = client.get(&video_uri);
        if provider == "gemini" {
            req = req.header("x-goog-api-key", &api_key);
        }
        req.send()
            .await
            .map_err(|e| format!("下载视频失败: {}", e))?
    };

    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("下载失败 ({}): {}", status, text));
    }
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("读取视频字节失败: {}", e))?;
    std::fs::write(&dest, &bytes).map_err(|e| format!("写入视频失败: {}", e))?;
    Ok(dest.to_string_lossy().into_owned())
}

// ========= ffmpeg 抠图 & 辅助 =========

#[tauri::command]
pub async fn video_chroma_key(
    app: AppHandle,
    character_id: String,
    input_relative: String,
    output_relative: String,
    key_color_hex: Option<String>,
    similarity: Option<f64>,
    blend: Option<f64>,
) -> Result<String, String> {
    ensure_safe_relative(&input_relative)?;
    ensure_safe_relative(&output_relative)?;

    let root = characters_root(&app)?.join(&character_id);
    let input = root.join(&input_relative);
    let output = root.join(&output_relative);
    if !input.exists() {
        return Err(format!("输入视频不存在: {}", input.display()));
    }
    if let Some(parent) = output.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("创建输出目录失败: {}", e))?;
    }

    let key_color = key_color_hex
        .unwrap_or_else(|| "#00FF00".into())
        .trim_start_matches('#')
        .to_uppercase();
    let key_color = format!("0x{}", key_color);
    let similarity = similarity.unwrap_or(0.15);
    let blend = blend.unwrap_or(0.1);

    let vf = format!(
        "chromakey={}:{:.3}:{:.3},format=yuva420p",
        key_color, similarity, blend
    );

    let status = Command::new("ffmpeg")
        .args([
            "-y",
            "-i",
            input.to_str().ok_or("输入路径含非法字符")?,
            "-vf",
            &vf,
            "-c:v",
            "libvpx-vp9",
            "-pix_fmt",
            "yuva420p",
            "-b:v",
            "1M",
            "-auto-alt-ref",
            "0",
            "-metadata:s:v:0",
            "alpha_mode=1",
            "-an",
            output.to_str().ok_or("输出路径含非法字符")?,
        ])
        .status()
        .await
        .map_err(|e| format!("调用 ffmpeg 失败: {}（请确认系统已安装 ffmpeg）", e))?;

    if !status.success() {
        return Err(format!("ffmpeg 抠图失败（退出码 {:?}）", status.code()));
    }
    Ok(output.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn video_check_ffmpeg() -> Result<bool, String> {
    let result = Command::new("ffmpeg").arg("-version").output().await;
    Ok(result.map(|o| o.status.success()).unwrap_or(false))
}

#[tauri::command]
pub async fn character_read_bytes(
    app: AppHandle,
    character_id: String,
    relative_path: String,
) -> Result<Vec<u8>, String> {
    ensure_safe_relative(&relative_path)?;
    let p = characters_root(&app)?
        .join(&character_id)
        .join(&relative_path);
    std::fs::read(&p).map_err(|e| format!("读取失败 {}: {}", p.display(), e))
}

// ---- 内部辅助 ----

fn characters_root(app: &AppHandle) -> Result<PathBuf, String> {
    let mut p = app.path().app_data_dir().map_err(|e| e.to_string())?;
    p.push("characters");
    Ok(p)
}

fn ensure_safe_relative(path: &str) -> Result<(), String> {
    if path.contains("..") || Path::new(path).is_absolute() {
        return Err(format!("非法路径: {}", path));
    }
    Ok(())
}
