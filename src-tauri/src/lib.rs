mod tray;
mod commands;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            tray::setup_tray(app)?;
            // 移除桌宠窗口的系统阴影，避免透明窗口出现黑色边框
            if let Some(win) = app.get_webview_window("pet") {
                let _ = win.set_shadow(false);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::window::create_chat_window,
            commands::window::create_task_window,
            commands::window::create_settings_window,
            commands::window::get_pet_cursor_local_pos,
            commands::llm::llm_chat,
            commands::llm::llm_check,
        ])
        .run(tauri::generate_context!())
        .expect("启动 CyberPet 失败");
}
