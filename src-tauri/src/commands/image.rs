use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde_json::Value;
use std::time::Duration;

/// 图像生成命令的统一入口，按 provider 分发到具体实现。
///
/// payload 字段约定（前端 Provider 实现传入）：
///   prompt / negative_prompt / width / height / seed / count
///   reference_image_b64 / reference_strength  -- 仅即梦
///   workflow_json                              -- 仅 ComfyUI（前端已注入占位符）
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
        "comfyui" => comfyui_generate(api_url, payload).await,
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
        body["image"] = Value::String(format!("data:image/png;base64,{}", img));
        if let Some(st) = strength {
            // 方舟 img2img：strength 字段在部分模型上命名为 guidance_scale，按需扩展
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

    // 轮询最多 180 秒
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

/// 统一健康检查：按 provider 分发
#[tauri::command]
pub async fn image_check(
    provider: String,
    api_url: String,
    api_key: String,
) -> Result<bool, String> {
    match provider.as_str() {
        "jimeng" => {
            let url = format!("{}/models", api_url.trim_end_matches('/'));
            let client = reqwest::Client::new();
            let result = client
                .get(&url)
                .header("Authorization", format!("Bearer {}", api_key))
                .timeout(Duration::from_secs(5))
                .send()
                .await;
            Ok(result.map(|r| r.status().is_success()).unwrap_or(false))
        }
        "comfyui" => comfyui_ping(api_url).await,
        _ => Ok(false),
    }
}
