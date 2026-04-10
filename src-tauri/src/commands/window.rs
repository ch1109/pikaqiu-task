use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

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
        .inner_size(440.0, 680.0)
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
