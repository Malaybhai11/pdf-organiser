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
            
            // Resolve PDFium path: src-tauri/bin for dev, /bin in resource dir for prod
            let pdfium_path = if cfg!(debug_assertions) {
                std::env::current_dir()?.join("bin")
            } else {
                app.path().resource_dir()?.join("bin")
            };

            let customers_path = app_data.join("customers");
            let manager = CustomerManager::new(customers_path, pdfium_path);
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
            commands::merge_documents,
            commands::extract_pages,
            commands::get_pdf_page_count,
            commands::render_pdf_page,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
