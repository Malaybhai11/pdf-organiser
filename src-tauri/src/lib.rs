mod customer_manager;
mod commands;

use tauri::Manager;
use customer_manager::CustomerManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data = app.path().app_data_dir()
                .expect("Failed to get app data directory");
            
            let customers_path = app_data.join("customers");
            
            // Shared manager with thread-safe PDFium access
            let manager = CustomerManager::new(customers_path);
            manager.init().expect("Failed to initialize customer storage");
            
            app.manage(manager);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::create_customer_folder,
            commands::delete_customer,
            commands::update_customer_name,
            commands::save_customer_file,
            commands::get_customer_files,
            commands::get_customers,
            commands::get_customers_with_names,
            commands::merge_documents,
            commands::extract_pages,
            commands::get_pdf_page_count,
            commands::render_pdf_page,
            commands::get_customer_metadata,
            commands::update_file_tags,
            commands::download_file,
            commands::delete_file,
            commands::upload_file_from_path,
            commands::upload_files_from_paths,
            commands::rotate_pdf_pages,
            commands::rename_file,
            commands::get_pdf_metadata,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
