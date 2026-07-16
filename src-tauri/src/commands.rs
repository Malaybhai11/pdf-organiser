use tauri::{State, Window, Emitter};
use crate::customer_manager::{CustomerManager, CustomerMetadata, Customer};
use serde::Serialize;
use anyhow::Result;

#[derive(Serialize)]
pub struct CommandResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> CommandResponse<T> {
    pub fn ok(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }
}

#[derive(Clone, Serialize)]
pub struct ProgressPayload {
    pub status: String,
    pub message: String,
}

#[tauri::command]
pub async fn create_customer_folder(
    manager: State<'_, CustomerManager>,
    customer_id: String,
    name: String,
) -> Result<CommandResponse<()>, String> {
    manager.create_customer(&customer_id, &name)
        .map(|_| CommandResponse::ok(()))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_customer(
    manager: State<'_, CustomerManager>,
    customer_id: String,
) -> Result<CommandResponse<()>, String> {
    manager.delete_customer(&customer_id)
        .map(|_| CommandResponse::ok(()))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_customer_name(
    manager: State<'_, CustomerManager>,
    customer_id: String,
    name: String,
) -> Result<CommandResponse<()>, String> {
    manager.update_customer_name(&customer_id, &name)
        .map(|_| CommandResponse::ok(()))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_customer_file(
    manager: State<'_, CustomerManager>,
    customer_id: String,
    file_name: String,
    file_data: Vec<u8>,
) -> Result<CommandResponse<String>, String> {
    manager.save_original_file(&customer_id, &file_name, file_data)
        .map(|name| CommandResponse::ok(name))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_customer_files(
    manager: State<'_, CustomerManager>,
    customer_id: String,
) -> Result<CommandResponse<Vec<String>>, String> {
    manager.list_original_files(&customer_id)
        .map(|files| CommandResponse::ok(files))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_customers(
    manager: State<'_, CustomerManager>,
) -> Result<CommandResponse<Vec<String>>, String> {
    manager.list_customers_with_names()
        .map(|customers| CommandResponse::ok(customers.into_iter().map(|c| c.id).collect()))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_customers_with_names(
    manager: State<'_, CustomerManager>,
) -> Result<CommandResponse<Vec<Customer>>, String> {
    manager.list_customers_with_names()
        .map(|customers| CommandResponse::ok(customers))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn merge_documents(
    manager: State<'_, CustomerManager>,
    window: Window,
    customer_id: String,
    file_names: Vec<String>,
) -> Result<CommandResponse<String>, String> {
    let progress_handler = |msg: String| {
        let _ = window.emit("pdf-progress", ProgressPayload {
            status: "processing".to_string(),
            message: msg,
        });
    };

    manager.merge_documents(&customer_id, file_names, progress_handler)
        .and_then(|name| manager.copy_to_downloads(&customer_id, &name))
        .map(CommandResponse::ok)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn extract_pages(
    manager: State<'_, CustomerManager>,
    customer_id: String,
    file_name: String,
    page_indices: Vec<u16>,
) -> Result<CommandResponse<String>, String> {
    manager.extract_pages(&customer_id, &file_name, page_indices)
        .map(|name| CommandResponse::ok(name))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_pdf_page_count(
    manager: State<'_, CustomerManager>,
    customer_id: String,
    file_name: String,
) -> Result<CommandResponse<u16>, String> {
    manager.get_pdf_page_count(&customer_id, &file_name)
        .map(|count| CommandResponse::ok(count))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn render_pdf_page(
    manager: State<'_, CustomerManager>,
    customer_id: String,
    file_name: String,
    page_index: u16,
) -> Result<CommandResponse<String>, String> {
    manager.render_pdf_page_to_base64(&customer_id, &file_name, page_index)
        .map(|b64| CommandResponse::ok(b64))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_customer_metadata(
    manager: State<'_, CustomerManager>,
    customer_id: String,
) -> Result<CommandResponse<CustomerMetadata>, String> {
    manager.get_customer_metadata(&customer_id)
        .map(|meta| CommandResponse::ok(meta))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_file_tags(
    manager: State<'_, CustomerManager>,
    customer_id: String,
    file_name: String,
    tags: Vec<String>,
) -> Result<CommandResponse<()>, String> {
    manager.update_file_tags(&customer_id, &file_name, tags)
        .map(|_| CommandResponse::ok(()))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn download_file(
    manager: State<'_, CustomerManager>,
    customer_id: String,
    file_name: String,
) -> Result<CommandResponse<String>, String> {
    manager.copy_to_downloads(&customer_id, &file_name)
        .map(|path| CommandResponse::ok(path))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_file(
    manager: State<'_, CustomerManager>,
    customer_id: String,
    file_name: String,
) -> Result<CommandResponse<()>, String> {
    manager.delete_file(&customer_id, &file_name)
        .map(|_| CommandResponse::ok(()))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn upload_file_from_path(
    manager: State<'_, CustomerManager>,
    customer_id: String,
    file_path: String,
) -> Result<CommandResponse<String>, String> {
    manager.upload_from_path(&customer_id, &file_path)
        .map(|name| CommandResponse::ok(name))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn upload_files_from_paths(
    manager: State<'_, CustomerManager>,
    customer_id: String,
    file_paths: Vec<String>,
) -> Result<CommandResponse<Vec<String>>, String> {
    manager.upload_from_paths(&customer_id, file_paths)
        .map(CommandResponse::ok)
        .map_err(|e| e.to_string())
}

#[derive(Serialize)]
pub struct PdfMetadata {
    pub title: Option<String>,
    pub author: Option<String>,
    pub creator: Option<String>,
    pub producer: Option<String>,
    pub page_count: usize,
    pub created: Option<String>,
    pub modified: Option<String>,
    pub file_size: u64,
    pub file_name: String,
}

#[tauri::command]
pub async fn get_pdf_metadata(
    manager: State<'_, CustomerManager>,
    customer_id: String,
    file_name: String,
) -> Result<CommandResponse<PdfMetadata>, String> {
    manager.get_pdf_metadata(&customer_id, &file_name)
        .map(CommandResponse::ok)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn rename_file(
    manager: State<'_, CustomerManager>,
    customer_id: String,
    old_name: String,
    new_name: String,
) -> Result<CommandResponse<()>, String> {
    manager.rename_customer_file(&customer_id, &old_name, &new_name)
        .map(|_| CommandResponse::ok(()))
        .map_err(|e| e.to_string())
}


#[tauri::command]
pub async fn rotate_pdf_pages(
    manager: State<'_, CustomerManager>,
    customer_id: String,
    file_name: String,
    rotation: i32,
) -> Result<CommandResponse<String>, String> {
    manager.rotate_pdf_pages(&customer_id, &file_name, rotation)
        .map(CommandResponse::ok)
        .map_err(|e| e.to_string())
}


#[tauri::command]
pub async fn split_pdf_by_range(
    manager: State<'_, CustomerManager>,
    customer_id: String,
    file_name: String,
    start_page: usize,
    end_page: usize,
) -> Result<CommandResponse<String>, String> {
    manager.split_pdf_range(&customer_id, &file_name, start_page, end_page)
        .map(CommandResponse::ok)
        .map_err(|e| e.to_string())
}


#[tauri::command]
pub async fn merge_with_progress(
    window: Window,
    manager: State<'_, CustomerManager>,
    customer_id: String,
    file_names: Vec<String>,
) -> Result<CommandResponse<String>, String> {
    let total = file_names.len();
    for (i, file_name) in file_names.iter().enumerate() {
        let _ = window.emit("merge-progress", ProgressPayload {
            status: "merging".to_string(),
            message: format!("Merging file {} of {}: {}", i + 1, total, file_name),
        });
    }
    manager.merge_documents(&customer_id, &file_names)
        .map(|path| CommandResponse::ok(path))
        .map_err(|e| e.to_string())
}
