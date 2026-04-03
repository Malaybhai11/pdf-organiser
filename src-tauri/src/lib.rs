mod customer_manager;
mod commands;

use customer_manager::CustomerManager;
use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Define the base path for customers. 
            // In a real app, this should be in the AppData directory.
            let app_data = app.path().app_data_dir()
                .expect("Failed to get app data directory");
            
            let customers_path = app_data.join("customers");
            
            let manager = CustomerManager::new(customers_path);
            manager.init().expect("Failed to initialize customer storage");
            
            app.manage(manager);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::create_customer_folder,
            commands::save_customer_file,
            commands::get_customer_files,
            commands::get_customers,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
