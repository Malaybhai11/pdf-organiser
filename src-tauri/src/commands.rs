use tauri::{State, Window, Emitter};
use crate::customer_manager::CustomerManager;
use serde::Serialize;
use anyhow::Result;

#[derive(Serialize)]
pub struct CommandResponse<T> {
    success: boolean,
    data: Option<T>,
    error: Option<String>,
}

impl<T> CommandResponse<T> {
    fn ok(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    fn err(e: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(e),
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
) -> Result<CommandResponse<()>, String> {
    manager.create_customer(&customer_id)
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
    manager.list_customers()
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
        .map(|name| CommandResponse::ok(name))
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
