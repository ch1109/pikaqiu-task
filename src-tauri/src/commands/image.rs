use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde_json::Value;
use std::time::Duration;

use crate::commands::providers::{build_kling_jwt, normalize_b64};

/// 图像生成命令的统一入口，按 provider 分发到具体实现。
///
/// payload 字段约定（前端 Provider 实现传入）：
///   prompt / negative_prompt / width / height / seed / count
///   reference_image_b64 / reference_strength
///   workflow_json                              -- 仅 ComfyUI
///   secret_key                                 -- 仅 Kling（AK+SK）
#[tauri::command]
pub async fn image_generate(
    provider: String,
    api_url: String,
    api_key: String,
    model: String,
    payload: Value,
) -> Result<Value, String> {
    match provider.as_str() {
        "jimeng" => jimeng_generate(api_url, api_key, model, payload).await,
        "kling" => kling_generate(api_url, api_key, model, payload).await,
        "minimax" => minimax_generate(api_url, api_key, model, payload).await,
        "comfyui" => comfyui_generate(api_url, payload).await,
        "openai-compat" => openai_compat_generate(api_url, api_key, model, payload).await,
        "replicate" => replicate_image_generate(api_url, api_key, model, payload).await,
        other => Err(format!("未知图像生成 Provider: {}", other)),
    }
}

/// 即梦（火山方舟图像生成）实现
/// API 参考：https://www.volcengine.com/docs/82379/1541523
async fn jimeng_generate(
    api_url: String,
    api_key: String,
    model: String,
    payload: Value,
) -> Result<Value, String> {
    let prompt = payload
        .get("prompt")
        .and_then(|v| v.as_str())
        .ok_or("缺少 prompt 字段")?
        .to_string();
    let width = payload.get("width").and_then(|v| v.as_u64()).unwrap_or(512);
    let height = payload.get("height").and_then(|v| v.as_u64()).unwrap_or(512);
    let seed = payload.get("seed").and_then(|v| v.as_u64());
    let count = payload.get("count").and_then(|v| v.as_u64()).unwrap_or(1);
    let negative = payload
        .get("negative_prompt")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let ref_img = payload
        .get("reference_image_b64")
        .and_then(|v| v.as_str());
    let strength = payload
        .get("reference_strength")
        .and_then(|v| v.as_f64());

    let base = api_url.trim_end_matches('/');
    let url = format!("{}/images/generations", base);

    let mut body = serde_json::json!({
        "model": model,
        "prompt": prompt,
        "size": format!("{}x{}", width, height),
        "response_format": "b64_json",
        "n": count,
        "watermark": false,
    });
    if let Some(s) = seed {
        body["seed"] = Value::from(s);
    }
    if !negative.is_empty() {
        body["negative_prompt"] = Value::String(negative.to_string());
    }
    if let Some(img) = ref_img {
        body["image"] = Value::String(format!("data:image/png;base64,{}", normalize_b64(img)));
        if let Some(st) = strength {
            body["strength"] = Value::from(st);
        }
    }

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .timeout(Duration::from_secs(120))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("即梦网络请求失败: {}", e))?;

    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("读取响应失败: {}", e))?;
    if !status.is_success() {
        return Err(format!("即梦 API 请求失败 ({}): {}", status, text));
    }

    let raw: Value = serde_json::from_str(&text)
        .map_err(|e| format!("解析响应失败: {} / 原始: {}", e, text))?;

    let data = raw
        .get("data")
        .and_then(|v| v.as_array())
        .ok_or_else(|| format!("即梦响应缺少 data 字段: {}", text))?;

    let images: Vec<Value> = data
        .iter()
        .map(|item| {
            let mut obj = serde_json::Map::new();
            if let Some(b64) = item.get("b64_json").and_then(|v| v.as_str()) {
                obj.insert("b64".into(), Value::String(b64.to_string()));
            }
            if let Some(u) = item.get("url").and_then(|v| v.as_str()) {
                obj.insert("url".into(), Value::String(u.to_string()));
            }
            if let Some(s) = seed {
                obj.insert("seed".into(), Value::from(s));
            }
            Value::Object(obj)
        })
        .collect();

    Ok(serde_json::json!({
        "images": images,
        "cost_estimate": (count as f64) * 0.2
    }))
}

/// 可灵（Kling）图像生成：POST /v1/images/generations（异步）
/// payload.secret_key 必填（AK+SK 签 JWT）
async fn kling_generate(
    api_url: String,
    api_key: String,
    model: String,
    payload: Value,
) -> Result<Value, String> {
    let secret = payload
        .get("secret_key")
        .and_then(|v| v.as_str())
        .ok_or("Kling 缺少 secret_key")?;
    let token = build_kling_jwt(&api_key, secret)?;

    let prompt = payload
        .get("prompt")
        .and_then(|v| v.as_str())
        .ok_or("缺少 prompt 字段")?
        .to_string();
    let negative = payload
        .get("negative_prompt")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let aspect_ratio = payload
        .get("aspect_ratio")
        .and_then(|v| v.as_str())
        .unwrap_or("9:16");

    let base = api_url.trim_end_matches('/');
    let submit_url = format!("{}/v1/images/generations", base);

    let mut body = serde_json::json!({
        "model_name": model,
        "prompt": prompt,
        "aspect_ratio": aspect_ratio,
        "n": 1,
    });
    if !negative.is_empty() {
        body["negative_prompt"] = Value::String(negative.to_string());
    }
    if let Some(img) = payload.get("reference_image_b64").and_then(|v| v.as_str()) {
        body["image"] = Value::String(normalize_b64(img).to_string());
    }

    let client = reqwest::Client::new();
    let resp = client
        .post(&submit_url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .timeout(Duration::from_secs(30))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Kling 提交失败: {}", e))?;

    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("读取响应失败: {}", e))?;
    if !status.is_success() {
        return Err(format!("Kling 图像提交失败 ({}): {}", status, text));
    }
    let raw: Value = serde_json::from_str(&text)
        .map_err(|e| format!("解析 Kling 响应失败: {} / 原始: {}", e, text))?;
    let task_id = raw
        .pointer("/data/task_id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| format!("Kling 未返回 task_id: {}", text))?
        .to_string();

    // 轮询最多 10 分钟
    let poll_url = format!("{}/v1/images/generations/{}", base, task_id);
    let mut image_url: Option<String> = None;
    for _ in 0..120 {
        tokio::time::sleep(Duration::from_secs(5)).await;
        // JWT 每次可能过期，每轮新签
        let new_token = build_kling_jwt(&api_key, secret)?;
        let r = client
            .get(&poll_url)
            .header("Authorization", format!("Bearer {}", new_token))
            .timeout(Duration::from_secs(15))
            .send()
            .await
            .map_err(|e| format!("Kling 轮询失败: {}", e))?;
        if !r.status().is_success() {
            continue;
        }
        let rv: Value = r.json().await.map_err(|e| format!("解析轮询响应失败: {}", e))?;
        let task_status = rv
            .pointer("/data/task_status")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        if task_status == "succeed" {
            image_url = rv
                .pointer("/data/task_result/images/0/url")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            break;
        }
        if task_status == "failed" {
            return Err(format!("Kling 图像生成失败: {}", rv));
        }
    }
    let url = image_url.ok_or("Kling 图像生成超时（10 分钟）")?;

    // 拉回字节并转 base64，对齐既有 Provider 的"images: [{b64}]"输出形状
    let bytes = client
        .get(&url)
        .timeout(Duration::from_secs(60))
        .send()
        .await
        .map_err(|e| format!("下载 Kling 图片失败: {}", e))?
        .bytes()
        .await
        .map_err(|e| format!("读取 Kling 图片字节失败: {}", e))?;
    let b64 = STANDARD.encode(&bytes);
    Ok(serde_json::json!({
        "images": [{ "b64": b64, "url": url }],
        "cost_estimate": 0.3,
    }))
}

/// 海螺（MiniMax）图像生成：POST /v1/image_generation（同步）
async fn minimax_generate(
    api_url: String,
    api_key: String,
    model: String,
    payload: Value,
) -> Result<Value, String> {
    let prompt = payload
        .get("prompt")
        .and_then(|v| v.as_str())
        .ok_or("缺少 prompt 字段")?
        .to_string();
    let aspect_ratio = payload
        .get("aspect_ratio")
        .and_then(|v| v.as_str())
        .unwrap_or("9:16");
    let n = payload.get("count").and_then(|v| v.as_u64()).unwrap_or(1);

    let base = api_url.trim_end_matches('/');
    let url = format!("{}/v1/image_generation", base);

    let mut body = serde_json::json!({
        "model": model,
        "prompt": prompt,
        "aspect_ratio": aspect_ratio,
        "n": n,
        "response_format": "base64",
    });
    if let Some(img) = payload.get("reference_image_b64").and_then(|v| v.as_str()) {
        body["subject_reference"] = serde_json::json!([{
            "type": "character",
            "image_file": format!("data:image/png;base64,{}", normalize_b64(img))
        }]);
    }

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .timeout(Duration::from_secs(180))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("MiniMax 网络请求失败: {}", e))?;

    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("读取响应失败: {}", e))?;
    if !status.is_success() {
        return Err(format!("MiniMax API 请求失败 ({}): {}", status, text));
    }
    let raw: Value = serde_json::from_str(&text)
        .map_err(|e| format!("解析响应失败: {} / 原始: {}", e, text))?;

    let base_resp = raw.get("base_resp");
    if let Some(code) = base_resp.and_then(|b| b.get("status_code")).and_then(|v| v.as_i64()) {
        if code != 0 {
            let msg = base_resp
                .and_then(|b| b.get("status_msg"))
                .and_then(|v| v.as_str())
                .unwrap_or("未知错误");
            return Err(format!("MiniMax 错误 (code {}): {}", code, msg));
        }
    }

    let images = raw
        .pointer("/data/image_base64")
        .and_then(|v| v.as_array())
        .ok_or_else(|| format!("MiniMax 响应缺少 data.image_base64: {}", text))?;
    let out: Vec<Value> = images
        .iter()
        .filter_map(|v| v.as_str())
        .map(|s| serde_json::json!({ "b64": s }))
        .collect();

    Ok(serde_json::json!({
        "images": out,
        "cost_estimate": (n as f64) * 0.15,
    }))
}

/// OpenAI 兼容端点：POST {base_url}/images/generations（同步）
/// 兼容 LocalAI / Ollama / vLLM / Together AI / OpenRouter 等开源或聚合平台。
/// payload.image_size / payload.response_format 来自前端 customConfig
async fn openai_compat_generate(
    api_url: String,
    api_key: String,
    model: String,
    payload: Value,
) -> Result<Value, String> {
    let prompt = payload
        .get("prompt")
        .and_then(|v| v.as_str())
        .ok_or("缺少 prompt 字段")?
        .to_string();
    let negative = payload
        .get("negative_prompt")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let size = payload
        .get("image_size")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| {
            // 回退：按 width/height 拼
            let w = payload.get("width").and_then(|v| v.as_u64()).unwrap_or(1024);
            let h = payload.get("height").and_then(|v| v.as_u64()).unwrap_or(1024);
            format!("{}x{}", w, h)
        });
    let response_format = payload
        .get("response_format")
        .and_then(|v| v.as_str())
        .unwrap_or("b64_json")
        .to_string();
    let count = payload.get("count").and_then(|v| v.as_u64()).unwrap_or(1);

    // /v1/images/generations 是约定俗成路径；若用户已在 api_url 里带了 /v1 就别重复拼
    let base = api_url.trim_end_matches('/');
    let url = if base.ends_with("/v1") || base.contains("/v1/") {
        format!("{}/images/generations", base)
    } else {
        format!("{}/v1/images/generations", base)
    };

    let mut body = serde_json::json!({
        "model": model,
        "prompt": prompt,
        "n": count,
        "size": size,
        "response_format": response_format,
    });
    if !negative.is_empty() {
        // 部分后端支持 negative_prompt，其他会忽略
        body["negative_prompt"] = Value::String(negative.to_string());
    }

    let client = reqwest::Client::new();
    let mut req = client
        .post(&url)
        .header("Content-Type", "application/json")
        .timeout(Duration::from_secs(180))
        .json(&body);
    if !api_key.is_empty() {
        req = req.header("Authorization", format!("Bearer {}", api_key));
    }
    let resp = req
        .send()
        .await
        .map_err(|e| format!("OpenAI 兼容端点请求失败: {}", e))?;

    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("读取响应失败: {}", e))?;
    if !status.is_success() {
        return Err(format!("OpenAI 兼容端点请求失败 ({}): {}", status, text));
    }
    let raw: Value = serde_json::from_str(&text)
        .map_err(|e| format!("解析响应失败: {} / 原始: {}", e, text))?;
    let data = raw
        .get("data")
        .and_then(|v| v.as_array())
        .ok_or_else(|| format!("响应缺少 data 字段: {}", text))?;

    let mut images = Vec::with_capacity(data.len());
    for item in data {
        if let Some(b64) = item.get("b64_json").and_then(|v| v.as_str()) {
            images.push(serde_json::json!({ "b64": b64 }));
        } else if let Some(u) = item.get("url").and_then(|v| v.as_str()) {
            // 返回 URL 的后端需要我们自己下载成 b64
            let bytes = client
                .get(u)
                .timeout(Duration::from_secs(60))
                .send()
                .await
                .map_err(|e| format!("下载图片失败: {}", e))?
                .bytes()
                .await
                .map_err(|e| format!("读取图片字节失败: {}", e))?;
            let b64 = STANDARD.encode(&bytes);
            images.push(serde_json::json!({ "b64": b64, "url": u }));
        }
    }

    Ok(serde_json::json!({
        "images": images,
        "cost_estimate": 0.0,
    }))
}

/// Replicate 图像生成：POST /v1/predictions → 轮询 → 下载 output URL → b64
/// payload.version / payload.replicate_image_version 优先作为 version；否则把 model 当 version
async fn replicate_image_generate(
    api_url: String,
    api_key: String,
    model: String,
    payload: Value,
) -> Result<Value, String> {
    let prompt = payload
        .get("prompt")
        .and_then(|v| v.as_str())
        .ok_or("缺少 prompt 字段")?
        .to_string();
    let aspect_ratio = payload
        .get("aspect_ratio")
        .and_then(|v| v.as_str())
        .unwrap_or("1:1");
    let seed = payload.get("seed").and_then(|v| v.as_u64());
    let raw_version = payload
        .get("replicate_image_version")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .unwrap_or(&model)
        .to_string();

    let mut input = serde_json::json!({
        "prompt": prompt,
        "aspect_ratio": aspect_ratio,
    });
    if let Some(s) = seed {
        input["seed"] = Value::from(s);
    }
    if let Some(img) = payload.get("reference_image_b64").and_then(|v| v.as_str()) {
        input["image"] = Value::String(format!(
            "data:image/png;base64,{}",
            normalize_b64(img)
        ));
    }

    let base = api_url.trim_end_matches('/');
    let submit_url = format!("{}/v1/predictions", base);
    // "owner/model:hash" → 放进 version 字段；"owner/model" → 放进 model 字段走 latest
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
        .map_err(|e| format!("Replicate 提交失败: {}", e))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("读取响应失败: {}", e))?;
    if !status.is_success() {
        return Err(format!("Replicate 提交失败 ({}): {}", status, text));
    }
    let raw: Value = serde_json::from_str(&text)
        .map_err(|e| format!("解析 Replicate 响应失败: {} / 原始: {}", e, text))?;

    let get_url = raw
        .pointer("/urls/get")
        .and_then(|v| v.as_str())
        .ok_or_else(|| format!("Replicate 未返回 urls.get: {}", text))?
        .to_string();

    // 最多轮询 10 分钟（120 × 5s）
    let mut output: Option<Value> = None;
    for _ in 0..120 {
        tokio::time::sleep(Duration::from_secs(5)).await;
        let poll = client
            .get(&get_url)
            .header("Authorization", format!("Token {}", api_key))
            .timeout(Duration::from_secs(15))
            .send()
            .await
            .map_err(|e| format!("Replicate 轮询失败: {}", e))?;
        if !poll.status().is_success() {
            continue;
        }
        let pv: Value = poll.json().await.map_err(|e| format!("解析轮询响应失败: {}", e))?;
        let state = pv.get("status").and_then(|v| v.as_str()).unwrap_or("");
        match state {
            "succeeded" => {
                output = pv.get("output").cloned();
                break;
            }
            "failed" | "canceled" => {
                let err_detail = pv
                    .get("error")
                    .map(|e| e.to_string())
                    .unwrap_or_else(|| "未知错误".into());
                return Err(format!("Replicate 生成失败: {}", err_detail));
            }
            _ => {}
        }
    }
    let output = output.ok_or("Replicate 图像生成超时（10 分钟）")?;
    let urls = extract_replicate_image_urls(&output)
        .ok_or_else(|| format!("Replicate output 形状不认识: {}", output))?;

    let mut images = Vec::with_capacity(urls.len());
    for u in urls {
        let bytes = client
            .get(&u)
            .timeout(Duration::from_secs(60))
            .send()
            .await
            .map_err(|e| format!("下载 Replicate 图片失败: {}", e))?
            .bytes()
            .await
            .map_err(|e| format!("读取 Replicate 图片字节失败: {}", e))?;
        let b64 = STANDARD.encode(&bytes);
        images.push(serde_json::json!({ "b64": b64, "url": u }));
    }

    Ok(serde_json::json!({
        "images": images,
        "cost_estimate": 0.0,
    }))
}

/// 构造 Replicate 请求体：带 ':' 后缀的 version hash 放 version 字段，否则放 model
pub(crate) fn build_replicate_body(version: &str, input: Value) -> Value {
    if version.contains(':') {
        serde_json::json!({ "version": version.split(':').nth(1).unwrap_or(""), "input": input })
    } else {
        serde_json::json!({ "model": version, "input": input })
    }
}

/// Replicate 的 output 有多种形状，按常见情况降级匹配
fn extract_replicate_image_urls(output: &Value) -> Option<Vec<String>> {
    if let Some(arr) = output.as_array() {
        let urls: Vec<String> = arr
            .iter()
            .filter_map(|v| v.as_str().map(String::from))
            .collect();
        if !urls.is_empty() {
            return Some(urls);
        }
    }
    if let Some(s) = output.as_str() {
        return Some(vec![s.to_string()]);
    }
    // 对象里常见是 {image: "..."} 或 {images: [...]}
    if let Some(s) = output.get("image").and_then(|v| v.as_str()) {
        return Some(vec![s.to_string()]);
    }
    if let Some(arr) = output.get("images").and_then(|v| v.as_array()) {
        let urls: Vec<String> = arr
            .iter()
            .filter_map(|v| v.as_str().map(String::from))
            .collect();
        if !urls.is_empty() {
            return Some(urls);
        }
    }
    None
}

/// ComfyUI 本地实现：POST /prompt → 轮询 /history → GET /view 下载
async fn comfyui_generate(api_url: String, payload: Value) -> Result<Value, String> {
    let workflow = payload
        .get("workflow_json")
        .ok_or("缺少 workflow_json 字段")?
        .clone();

    let base = api_url.trim_end_matches('/').to_string();
    let client_id = uuid::Uuid::new_v4().to_string();
    let submit_body = serde_json::json!({ "prompt": workflow, "client_id": client_id });

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{}/prompt", base))
        .json(&submit_body)
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("ComfyUI 提交失败: {}", e))?;

    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("读取响应失败: {}", e))?;
    if !status.is_success() {
        return Err(format!("ComfyUI 提交失败 ({}): {}", status, text));
    }
    let submit: Value = serde_json::from_str(&text)
        .map_err(|e| format!("解析 ComfyUI 响应失败: {} / 原始: {}", e, text))?;
    let prompt_id = submit
        .get("prompt_id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| format!("ComfyUI 未返回 prompt_id: {}", text))?
        .to_string();

    let history_url = format!("{}/history/{}", base, prompt_id);
    let mut outputs: Option<Value> = None;
    for _ in 0..180 {
        let h = client
            .get(&history_url)
            .timeout(Duration::from_secs(5))
            .send()
            .await
            .map_err(|e| format!("ComfyUI 轮询失败: {}", e))?;
        if h.status().is_success() {
            let hv: Value = h
                .json()
                .await
                .map_err(|e| format!("解析 history 失败: {}", e))?;
            if let Some(entry) = hv.get(&prompt_id) {
                if let Some(out) = entry.get("outputs") {
                    if out
                        .as_object()
                        .map(|o| !o.is_empty())
                        .unwrap_or(false)
                    {
                        outputs = Some(out.clone());
                        break;
                    }
                }
            }
        }
        tokio::time::sleep(Duration::from_secs(1)).await;
    }
    let outputs = outputs.ok_or("ComfyUI 生成超时（180 秒）")?;

    let view_url = format!("{}/view", base);
    let mut images = Vec::new();
    if let Some(nodes) = outputs.as_object() {
        for (_node_id, node_out) in nodes {
            let Some(imgs) = node_out.get("images").and_then(|v| v.as_array()) else {
                continue;
            };
            for img_meta in imgs {
                let filename = img_meta
                    .get("filename")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let subfolder = img_meta
                    .get("subfolder")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let typ = img_meta
                    .get("type")
                    .and_then(|v| v.as_str())
                    .unwrap_or("output");
                let bytes = client
                    .get(&view_url)
                    .query(&[
                        ("filename", filename),
                        ("subfolder", subfolder),
                        ("type", typ),
                    ])
                    .timeout(Duration::from_secs(30))
                    .send()
                    .await
                    .map_err(|e| format!("下载 ComfyUI 图片失败: {}", e))?
                    .bytes()
                    .await
                    .map_err(|e| format!("读取 ComfyUI 图片字节失败: {}", e))?;
                let b64 = STANDARD.encode(&bytes);
                images.push(serde_json::json!({ "b64": b64 }));
            }
        }
    }

    Ok(serde_json::json!({
        "images": images,
        "cost_estimate": 0.0
    }))
}

/// 下载远程 URL 到本地文件（用于 Provider 返回 URL 而非 base64 的场景）
#[tauri::command]
pub async fn image_download_to_file(url: String, target_path: String) -> Result<(), String> {
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .timeout(Duration::from_secs(60))
        .send()
        .await
        .map_err(|e| format!("下载失败: {}", e))?;
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("读取响应失败: {}", e))?;
    let p = std::path::PathBuf::from(&target_path);
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
    }
    std::fs::write(&p, &bytes).map_err(|e| format!("写入失败: {}", e))?;
    Ok(())
}

/// 检测 ComfyUI 是否在线（GET /system_stats）
#[tauri::command]
pub async fn comfyui_ping(api_url: String) -> Result<bool, String> {
    let url = format!("{}/system_stats", api_url.trim_end_matches('/'));
    let client = reqwest::Client::new();
    let result = client
        .get(&url)
        .timeout(Duration::from_secs(3))
        .send()
        .await;
    match result {
        Ok(resp) => Ok(resp.status().is_success()),
        Err(_) => Ok(false),
    }
}

/// 统一模型列表：按 provider 拉取可用模型名。
///   comfyui       → GET /object_info/CheckpointLoaderSimple 解析 ckpt_name 选项
///   openai-compat → GET {base}/models，取 data[].id（兼容 Ollama 原生 /api/tags 的 fallback）
///   其他          → 返回空数组（云端厂商不探测，用户填 model 名即可）
#[tauri::command]
pub async fn provider_list_models(
    provider: String,
    api_url: String,
    api_key: String,
) -> Result<Vec<String>, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(6))
        .build()
        .map_err(|e| format!("构建 HTTP 客户端失败: {}", e))?;
    match provider.as_str() {
        "comfyui" => {
            let base = api_url.trim_end_matches('/');
            let url = format!("{}/object_info/CheckpointLoaderSimple", base);
            let resp = client
                .get(&url)
                .send()
                .await
                .map_err(|e| format!("ComfyUI 未响应: {}", e))?;
            if !resp.status().is_success() {
                return Err(format!(
                    "ComfyUI /object_info 返回 {}",
                    resp.status()
                ));
            }
            let v: Value = resp
                .json()
                .await
                .map_err(|e| format!("解析 object_info JSON 失败: {}", e))?;
            // 结构：{ CheckpointLoaderSimple: { input: { required: { ckpt_name: [[...names], {...}] } } } }
            let names = v
                .get("CheckpointLoaderSimple")
                .and_then(|n| n.get("input"))
                .and_then(|n| n.get("required"))
                .and_then(|n| n.get("ckpt_name"))
                .and_then(|n| n.as_array())
                .and_then(|arr| arr.first())
                .and_then(|first| first.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|x| x.as_str().map(|s| s.to_string()))
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            Ok(names)
        }
        "openai-compat" => {
            let base = api_url.trim_end_matches('/');
            // 兼容用户填 http://127.0.0.1:11434 (不带 /v1) 的场景
            let url = if base.ends_with("/v1") || base.contains("/v1/") {
                format!("{}/models", base)
            } else {
                format!("{}/v1/models", base)
            };
            let mut req = client.get(&url);
            if !api_key.trim().is_empty() {
                req = req.header("Authorization", format!("Bearer {}", api_key));
            }
            let resp = req
                .send()
                .await
                .map_err(|e| format!("本地服务未响应: {}", e))?;
            if !resp.status().is_success() {
                return Err(format!(
                    "GET /models 返回 {}，请确认 endpoint 与 API Key",
                    resp.status()
                ));
            }
            let v: Value = resp
                .json()
                .await
                .map_err(|e| format!("解析模型列表 JSON 失败: {}", e))?;
            let ids = v
                .get("data")
                .and_then(|d| d.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|item| {
                            item.get("id").and_then(|s| s.as_str()).map(|s| s.to_string())
                        })
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            Ok(ids)
        }
        _ => Ok(vec![]),
    }
}

/// 统一健康检查：按 provider 分发
#[tauri::command]
pub async fn image_check(
    provider: String,
    api_url: String,
    api_key: String,
) -> Result<bool, String> {
    match provider.as_str() {
        "jimeng" | "minimax" | "openai-compat" => {
            // 三家都走 /models 列举接口；openai-compat 连通性判断复用该约定
            let base = api_url.trim_end_matches('/');
            let url = if base.ends_with("/v1") || base.contains("/v1/") {
                format!("{}/models", base)
            } else if provider == "openai-compat" {
                format!("{}/v1/models", base)
            } else {
                format!("{}/models", base)
            };
            let client = reqwest::Client::new();
            let result = client
                .get(&url)
                .header("Authorization", format!("Bearer {}", api_key))
                .timeout(Duration::from_secs(5))
                .send()
                .await;
            Ok(result.map(|r| r.status().is_success()).unwrap_or(false))
        }
        "replicate" => {
            if api_key.is_empty() {
                return Ok(false);
            }
            let base = api_url.trim_end_matches('/');
            let url = format!("{}/v1/account", base);
            let client = reqwest::Client::new();
            let result = client
                .get(&url)
                .header("Authorization", format!("Token {}", api_key))
                .timeout(Duration::from_secs(5))
                .send()
                .await;
            Ok(result.map(|r| r.status().is_success()).unwrap_or(false))
        }
        "kling" => Ok(!api_key.is_empty()),
        "comfyui" => comfyui_ping(api_url).await,
        _ => Ok(false),
    }
}
