use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use serde::Serialize;

/// Kling JWT claims —— 官方文档 v1 要求：
///   iss: AccessKey
///   exp: unix 秒，当前时间 + 1800（30 分钟）
///   nbf: unix 秒，当前时间 - 5（容忍小量时钟偏差）
#[derive(Serialize)]
struct KlingClaims {
    iss: String,
    exp: i64,
    nbf: i64,
}

/// 生成 Kling API 所需的 JWT（HS256，SecretKey 直接作为 HMAC key）。
/// 每次请求前重签一次 —— token 30 分钟过期，不做缓存以避开窗口边界。
pub fn build_kling_jwt(access_key: &str, secret_key: &str) -> Result<String, String> {
    if access_key.is_empty() || secret_key.is_empty() {
        return Err("Kling AK/SK 不能为空".into());
    }
    let now = chrono::Utc::now().timestamp();
    let claims = KlingClaims {
        iss: access_key.to_string(),
        exp: now + 1800,
        nbf: now - 5,
    };
    let mut header = Header::new(Algorithm::HS256);
    header.typ = Some("JWT".into());
    encode(
        &header,
        &claims,
        &EncodingKey::from_secret(secret_key.as_bytes()),
    )
    .map_err(|e| format!("生成 Kling JWT 失败: {}", e))
}

/// 去掉 `data:image/...;base64,` 前缀，返回纯 base64 字符串
pub fn normalize_b64(raw: &str) -> &str {
    match raw.split_once(",") {
        Some((head, body)) if head.starts_with("data:") => body,
        _ => raw,
    }
}
