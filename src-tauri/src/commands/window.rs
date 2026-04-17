use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

/// 读取鼠标全局位置并换算到 pet 窗口的本地逻辑坐标。
///
/// 为什么需要：
/// 当桌宠窗口通过 setIgnoreCursorEvents(true) 启用穿透时，WebView 收不到任何
/// 鼠标事件，前端 `document.mousemove` 失效。但 Rust 侧 `cursor_position` 读的是
/// 全屏幕坐标，不受 ignoreCursorEvents 影响 —— 前端轮询它就可以计算鼠标是否
/// 回到桌宠命中区，进而动态切换 ignoreCursorEvents。
#[tauri::command]
pub async fn get_pet_cursor_local_pos(
    app: AppHandle,
) -> Result<Option<(f64, f64)>, String> {
    let Some(win) = app.get_webview_window("pet") else {
        return Ok(None);
    };
    let cursor = win.cursor_position().map_err(|e| e.to_string())?;
    let outer = win.outer_position().map_err(|e| e.to_string())?;
    let scale = win.scale_factor().map_err(|e| e.to_string())?;

    let local_x = (cursor.x - outer.x as f64) / scale;
    let local_y = (cursor.y - outer.y as f64) / scale;
    Ok(Some((local_x, local_y)))
}

#[tauri::command]
pub async fn create_chat_window(app: AppHandle) -> Result<(), String> {
    // 如果窗口已存在，直接显示
    if let Some(win) = app.get_webview_window("chat") {
        win.show().map_err(|e| e.to_string())?;
        win.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    WebviewWindowBuilder::new(&app, "chat", WebviewUrl::App("index.html".into()))
        .title("CyberPet 对话")
        .inner_size(500.0, 700.0)
        .min_inner_size(380.0, 500.0)
        .decorations(false)
        .transparent(true)
        .resizable(true)
        .center()
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn create_task_window(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("task") {
        win.show().map_err(|e| e.to_string())?;
        win.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    WebviewWindowBuilder::new(&app, "task", WebviewUrl::App("index.html".into()))
        .title("CyberPet 任务")
        .inner_size(580.0, 820.0)
        .decorations(false)
        .transparent(true)
        .resizable(true)
        .center()
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn create_settings_window(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("settings") {
        win.show().map_err(|e| e.to_string())?;
        win.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    WebviewWindowBuilder::new(&app, "settings", WebviewUrl::App("index.html".into()))
        .title("CyberPet 设置")
        .inner_size(480.0, 600.0)
        .decorations(false)
        .transparent(true)
        .resizable(false)
        .center()
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}
