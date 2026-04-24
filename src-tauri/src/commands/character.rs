use base64::{engine::general_purpose::STANDARD, Engine as _};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn characters_root(app: &AppHandle) -> Result<PathBuf, String> {
    let mut p = app.path().app_data_dir().map_err(|e| e.to_string())?;
    p.push("characters");
    Ok(p)
}

fn drafts_root(app: &AppHandle) -> Result<PathBuf, String> {
    let mut p = app.path().app_data_dir().map_err(|e| e.to_string())?;
    p.push("character_drafts");
    Ok(p)
}

fn ensure_safe_relative(path: &str) -> Result<(), String> {
    if path.contains("..") || path.starts_with('/') || path.starts_with('\\') {
        return Err(format!("非法路径: {}", path));
    }
    Ok(())
}

/// 获取角色目录（不存在则创建），返回绝对路径
#[tauri::command]
pub async fn character_dir(app: AppHandle, character_id: String) -> Result<String, String> {
    let mut p = characters_root(&app)?;
    p.push(&character_id);
    fs::create_dir_all(&p).map_err(|e| format!("创建角色目录失败: {}", e))?;
    Ok(p.to_string_lossy().into_owned())
}

/// 列出某动作目录下所有 PNG 帧，按文件名排序，读为 data URL 数组
#[tauri::command]
pub async fn character_list_frames(
    app: AppHandle,
    character_id: String,
    action_name: String,
) -> Result<Vec<String>, String> {
    let mut p = characters_root(&app)?;
    p.push(&character_id);
    p.push(&action_name);
    if !p.exists() {
        return Ok(vec![]);
    }
    let mut entries: Vec<PathBuf> = fs::read_dir(&p)
        .map_err(|e| format!("读取目录失败: {}", e))?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.extension().and_then(|e| e.to_str()) == Some("png"))
        .collect();
    entries.sort();
    let mut out = Vec::with_capacity(entries.len());
    for path in entries {
        let bytes = fs::read(&path)
            .map_err(|e| format!("读取帧失败 {}: {}", path.display(), e))?;
        out.push(format!("data:image/png;base64,{}", STANDARD.encode(&bytes)));
    }
    Ok(out)
}

/// 删除整个角色目录（级联删除所有帧）
#[tauri::command]
pub async fn character_delete_dir(
    app: AppHandle,
    character_id: String,
) -> Result<(), String> {
    let mut p = characters_root(&app)?;
    p.push(&character_id);
    if p.exists() {
        fs::remove_dir_all(&p).map_err(|e| format!("删除角色目录失败: {}", e))?;
    }
    Ok(())
}

/// 写入 PNG 字节到角色目录下的相对路径，自动创建父目录
#[tauri::command]
pub async fn character_save_png_bytes(
    app: AppHandle,
    character_id: String,
    relative_path: String,
    bytes: Vec<u8>,
) -> Result<String, String> {
    ensure_safe_relative(&relative_path)?;
    let mut p = characters_root(&app)?;
    p.push(&character_id);
    p.push(&relative_path);
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
    }
    fs::write(&p, &bytes).map_err(|e| format!("写入 PNG 失败: {}", e))?;
    Ok(p.to_string_lossy().into_owned())
}

/// 通用字节落盘（PNG / MP4 / WebM 等均复用），本地导入入口使用
#[tauri::command]
pub async fn character_save_bytes(
    app: AppHandle,
    character_id: String,
    relative_path: String,
    bytes: Vec<u8>,
) -> Result<String, String> {
    ensure_safe_relative(&relative_path)?;
    let mut p = characters_root(&app)?;
    p.push(&character_id);
    p.push(&relative_path);
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
    }
    fs::write(&p, &bytes).map_err(|e| format!("写入失败: {}", e))?;
    Ok(p.to_string_lossy().into_owned())
}

/// 在系统文件管理器中打开角色目录（方便用户手动查看素材）
#[tauri::command]
pub async fn character_open_dir(
    app: AppHandle,
    character_id: String,
) -> Result<(), String> {
    let mut p = characters_root(&app)?;
    p.push(&character_id);
    if !p.exists() {
        return Err("角色目录不存在".into());
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&p)
            .spawn()
            .map_err(|e| format!("打开目录失败: {}", e))?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&p)
            .spawn()
            .map_err(|e| format!("打开目录失败: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&p)
            .spawn()
            .map_err(|e| format!("打开目录失败: {}", e))?;
    }
    Ok(())
}

/// 草稿目录：写入 PNG（Step 2 候选图、Step 4 未确认帧先落盘这里）
#[tauri::command]
pub async fn draft_save_png_bytes(
    app: AppHandle,
    draft_id: String,
    relative_path: String,
    bytes: Vec<u8>,
) -> Result<String, String> {
    ensure_safe_relative(&relative_path)?;
    let mut p = drafts_root(&app)?;
    p.push(&draft_id);
    p.push(&relative_path);
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建草稿目录失败: {}", e))?;
    }
    fs::write(&p, &bytes).map_err(|e| format!("写入草稿失败: {}", e))?;
    Ok(p.to_string_lossy().into_owned())
}

/// 草稿目录：读取 PNG 为 data URL
#[tauri::command]
pub async fn draft_read_png_as_data_url(
    app: AppHandle,
    draft_id: String,
    relative_path: String,
) -> Result<String, String> {
    ensure_safe_relative(&relative_path)?;
    let mut p = drafts_root(&app)?;
    p.push(&draft_id);
    p.push(&relative_path);
    let bytes = fs::read(&p).map_err(|e| format!("读取草稿失败: {}", e))?;
    Ok(format!("data:image/png;base64,{}", STANDARD.encode(&bytes)))
}

/// 清理草稿目录
#[tauri::command]
pub async fn draft_delete_dir(app: AppHandle, draft_id: String) -> Result<(), String> {
    let mut p = drafts_root(&app)?;
    p.push(&draft_id);
    if p.exists() {
        fs::remove_dir_all(&p).map_err(|e| format!("删除草稿目录失败: {}", e))?;
    }
    Ok(())
}

/// 将草稿目录的某个文件搬家到角色目录（Step 5 确认时批量调用）
#[tauri::command]
pub async fn draft_promote_to_character(
    app: AppHandle,
    draft_id: String,
    draft_relative: String,
    character_id: String,
    character_relative: String,
) -> Result<String, String> {
    ensure_safe_relative(&draft_relative)?;
    ensure_safe_relative(&character_relative)?;
    let mut src = drafts_root(&app)?;
    src.push(&draft_id);
    src.push(&draft_relative);

    let mut dst = characters_root(&app)?;
    dst.push(&character_id);
    dst.push(&character_relative);

    if let Some(parent) = dst.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目标目录失败: {}", e))?;
    }

    // 优先 rename（同分区快），失败则 copy+delete
    if fs::rename(&src, &dst).is_err() {
        fs::copy(&src, &dst).map_err(|e| format!("拷贝失败: {}", e))?;
        let _ = fs::remove_file(&src);
    }
    Ok(dst.to_string_lossy().into_owned())
}
