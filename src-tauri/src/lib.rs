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
        .plugin(tauri_plugin_fs::init())
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
            commands::window::create_character_studio_window,
            commands::window::get_pet_cursor_local_pos,
            commands::llm::llm_chat,
            commands::llm::llm_check,
            commands::image::image_generate,
            commands::image::image_download_to_file,
            commands::image::image_check,
            commands::image::comfyui_ping,
            commands::character::character_dir,
            commands::character::character_list_frames,
            commands::character::character_delete_dir,
            commands::character::character_save_png_bytes,
            commands::character::character_open_dir,
            commands::character::draft_save_png_bytes,
            commands::character::draft_read_png_as_data_url,
            commands::character::draft_delete_dir,
            commands::character::draft_promote_to_character,
        ])
        .run(tauri::generate_context!())
        .expect("启动 CyberPet 失败");
}
