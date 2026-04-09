// 阻止 Windows 下弹出命令行窗口
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    cyberpet_lib::run()
}
