use std::fs;
pub use std::path::{Path, PathBuf};
use parking_lot::Mutex;
use anyhow::{Result, Context};
use sanitize_filename::sanitize;
use pdfium_render::prelude::*;
use image::GenericImageView;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::time::{Duration, Instant, UNIX_EPOCH};

// We use an unsafe wrapper because Pdfium is not Send, but we will ensure 
// serial access via a global Mutex. This is more efficient than re-binding on each call.
struct PdfiumWrapper(Pdfium);
unsafe impl Send for PdfiumWrapper {}

static PDFIUM: Lazy<Result<Mutex<PdfiumWrapper>, String>> = Lazy::new(|| {
    let mut search_paths = vec![
        "./bin".to_string(),
        "./src-tauri/bin".to_string(),
    ];

    // Add path relative to current executable
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            search_paths.push(exe_dir.to_string_lossy().to_string());
            search_paths.push(exe_dir.join("bin").to_string_lossy().to_string());
            search_paths.push(exe_dir.join("resources").join("bin").to_string_lossy().to_string());

            if let Some(parent_dir) = exe_dir.parent() {
                search_paths.push(parent_dir.join("Resources").join("bin").to_string_lossy().to_string());
                search_paths.push(parent_dir.join("resources").join("bin").to_string_lossy().to_string());
            }

            // In dev mode, exe is in target/debug, so we go up a few levels
            if let Some(project_root) = exe_dir.parent().and_then(|p| p.parent()) {
                search_paths.push(project_root.join("bin").to_string_lossy().to_string());
                search_paths.push(project_root.join("src-tauri/bin").to_string_lossy().to_string());
            }
        }
    }

    for path in &search_paths {
        let lib_path = Pdfium::pdfium_platform_library_name_at_path(path);
        if Path::new(&lib_path).exists() {
            match Pdfium::bind_to_library(&lib_path) {
                Ok(bindings) => return Ok(Mutex::new(PdfiumWrapper(Pdfium::new(bindings)))),
                Err(e) => {
                    println!("Found lib at {}, but failed to bind: {:?}", lib_path.display(), e);
                }
            }
        }
    }

    // Try system fallback
    match Pdfium::bind_to_system_library() {
        Ok(bindings) => Ok(Mutex::new(PdfiumWrapper(Pdfium::new(bindings)))),
        Err(e) => Err(format!("Failed to find or bind PDFium. Paths tried: {:?}. System error: {:?}", search_paths, e))
    }
});

macro_rules! get_pdfium {
    () => {
        PDFIUM.as_ref()
            .map_err(|e| anyhow::anyhow!(e.clone()))?
            .lock()
    };
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
pub struct FileMetadata {
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
pub struct CustomerMetadata {
    pub name: String,
    pub files: HashMap<String, FileMetadata>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Customer {
    pub id: String,
    pub name: String,
}

pub struct CustomerManager {
    base_path: PathBuf,
    recent_native_upload_batches: Mutex<HashMap<String, NativeUploadBatchState>>,
}

impl CustomerManager {
    pub fn new(base_path: PathBuf) -> Self {
        Self {
            base_path,
            recent_native_upload_batches: Mutex::new(HashMap::new()),
        }
    }

    pub fn init(&self) -> Result<()> {
        if !self.base_path.exists() {
            fs::create_dir_all(&self.base_path)
                .context("Failed to create base customers directory")?;
        }
        Ok(())
    }

    pub fn create_customer(&self, customer_id: &str, name: &str) -> Result<()> {
        let customer_dir = self.base_path.join(customer_id);
        fs::create_dir_all(customer_dir.join("original_files"))?;
        fs::create_dir_all(customer_dir.join("merged"))?;
        
        let metadata = CustomerMetadata {
            name: name.to_string(),
            ..Default::default()
        };
        self.save_customer_metadata(customer_id, &metadata)?;
        Ok(())
    }

    pub fn delete_customer(&self, customer_id: &str) -> Result<()> {
        let customer_dir = self.base_path.join(customer_id);
        if customer_dir.exists() {
            fs::remove_dir_all(customer_dir)?;
        }
        Ok(())
    }

    pub fn list_customers_with_names(&self) -> Result<Vec<Customer>> {
        if !self.base_path.exists() { return Ok(Vec::new()); }
        let mut results = Vec::new();
        for entry in fs::read_dir(&self.base_path)? {
            let entry = entry?;
            if entry.path().is_dir() {
                let id = entry.file_name().to_str().unwrap_or_default().to_string();
                let meta = self.get_customer_metadata(&id).unwrap_or_default();
                results.push(Customer { id: id.clone(), name: if meta.name.is_empty() { id } else { meta.name } });
            }
        }
        Ok(results)
    }

    pub fn update_customer_name(&self, customer_id: &str, name: &str) -> Result<()> {
        let mut meta = self.get_customer_metadata(customer_id)?;
        meta.name = name.to_string();
        self.save_customer_metadata(customer_id, &meta)
    }

    pub fn save_original_file(&self, customer_id: &str, file_name: &str, data: Vec<u8>) -> Result<String> {
        let target_dir = self.base_path.join(customer_id).join("original_files");
        if !target_dir.exists() { return Err(anyhow::anyhow!("Missing folder")); }
        let safe_name = self.generate_safe_filename(&target_dir, file_name);
        fs::write(target_dir.join(&safe_name), data)?;
        Ok(safe_name)
    }

    pub fn upload_from_path(&self, customer_id: &str, file_path: &str) -> Result<String> {
        Ok(self.upload_from_paths(customer_id, vec![file_path.to_string()])?
            .into_iter()
            .next()
            .unwrap_or_default())
    }

    pub fn upload_from_paths(&self, customer_id: &str, file_paths: Vec<String>) -> Result<Vec<String>> {
        let target_dir = self.base_path.join(customer_id).join("original_files");
        if !target_dir.exists() {
            return Err(anyhow::anyhow!("Customer folder missing"));
        }

        let sources = self.prepare_native_upload_sources(file_paths)?;
        if sources.is_empty() {
            return Ok(Vec::new());
        }

        let batch_key = self.native_upload_batch_key(customer_id, &sources);
        if !self.try_begin_native_upload_batch(&batch_key) {
            return Ok(Vec::new());
        }

        let upload_result = (|| -> Result<Vec<String>> {
            let mut uploaded_files = Vec::with_capacity(sources.len());
            for source in &sources {
                let safe_name = self.generate_safe_filename(&target_dir, &source.file_name);
                fs::copy(&source.path, target_dir.join(&safe_name))?;
                uploaded_files.push(safe_name);
            }
            Ok(uploaded_files)
        })();

        match upload_result {
            Ok(uploaded_files) => {
                self.finish_native_upload_batch(&batch_key);
                Ok(uploaded_files)
            }
            Err(error) => {
                self.clear_native_upload_batch(&batch_key);
                Err(error)
            }
        }
    }

    pub fn delete_file(&self, customer_id: &str, file_name: &str) -> Result<()> {
        let original_file = self.base_path.join(customer_id).join("original_files").join(file_name);
        let merged_file = self.base_path.join(customer_id).join("merged").join(file_name);
        
        let mut deleted = false;
        if original_file.exists() {
            fs::remove_file(original_file)?;
            deleted = true;
        }
        if merged_file.exists() {
            fs::remove_file(merged_file)?;
            deleted = true;
        }

        if !deleted {
            return Err(anyhow::anyhow!("File not found"));
        }

        // Cleanup metadata
        if let Ok(mut meta) = self.get_customer_metadata(customer_id) {
            meta.files.remove(file_name);
            let _ = self.save_customer_metadata(customer_id, &meta);
        }

        Ok(())
    }

    pub fn list_original_files(&self, customer_id: &str) -> Result<Vec<String>> {
        let mut files = Vec::new();
        
        // Only list user-uploaded original files
        let original_dir = self.base_path.join(customer_id).join("original_files");
        if original_dir.exists() {
            for entry in fs::read_dir(original_dir)? {
                let entry = entry?;
                if entry.path().is_file() {
                    if let Some(name) = entry.file_name().to_str() {
                        files.push(name.to_string());
                    }
                }
            }
        }

        files.sort();
        Ok(files)
    }

    pub fn merge_documents<F>(&self, customer_id: &str, file_names: Vec<String>, progress: F) -> Result<String> 
    where F: Fn(String) {
        let pdfium_guard = get_pdfium!();
        let pdfium = &pdfium_guard.0;

        let mut master_doc = pdfium.create_new_pdf()?;
        let original_dir = self.base_path.join(customer_id).join("original_files");
        let merged_dir = self.base_path.join(customer_id).join("merged");
        fs::create_dir_all(&merged_dir)?;

        for (index, file_name) in file_names.iter().enumerate() {
            if file_name == "final.pdf" { continue; }
            progress(format!("Adding {} ({} of {})", file_name, index + 1, file_names.len()));
            let path = original_dir.join(file_name);
            let ext = path.extension().and_then(|s| s.to_str()).unwrap_or_default().to_lowercase();

            if ext == "pdf" {
                let src = pdfium.load_pdf_from_file(&path, None)?;
                let src_len = src.pages().len();
                if src_len > 0 {
                    let master_doc_len = master_doc.pages().len();
                    master_doc.pages_mut().copy_page_range_from_document(&src, 0..=(src_len - 1), master_doc_len)?;
                }
            } else if matches!(ext.as_str(), "jpg" | "jpeg" | "png") {
                self.append_image_to_pdf_internal(pdfium, &mut master_doc, &path)?;
            }
        }

        let output_path = merged_dir.join("final.pdf");
        master_doc.save_to_file(&output_path)?;
        Ok("final.pdf".to_string())
    }

    pub fn extract_pages(&self, customer_id: &str, file_name: &str, page_indices: Vec<u16>) -> Result<String> {
        let pdfium_guard = get_pdfium!();
        let pdfium = &pdfium_guard.0;

        let mut source_path = self.base_path.join(customer_id).join("original_files").join(file_name);
        if !source_path.exists() {
             source_path = self.base_path.join(customer_id).join("merged").join(file_name);
        }

        let src = pdfium.load_pdf_from_file(&source_path, None)?;
        let mut new_doc = pdfium.create_new_pdf()?;

        for &idx in &page_indices {
            if idx < src.pages().len() {
                let new_doc_len = new_doc.pages().len();
                new_doc.pages_mut().copy_page_range_from_document(&src, idx..=idx, new_doc_len)?;
            }
        }

        let output_name = format!("extracted_{}", file_name);
        let output_path = self.base_path.join(customer_id).join("merged").join(&output_name);
        new_doc.save_to_file(&output_path)?;
        Ok(output_name)
    }

    pub fn get_pdf_page_count(&self, customer_id: &str, file_name: &str) -> Result<u16> {
        let pdfium_guard = get_pdfium!();
        let pdfium = &pdfium_guard.0;

        let mut path = self.base_path.join(customer_id).join("original_files").join(file_name);
        if !path.exists() {
            path = self.base_path.join(customer_id).join("merged").join(file_name);
        }
        
        let doc = pdfium.load_pdf_from_file(&path, None)?;
        Ok(doc.pages().len())
    }

    pub fn render_pdf_page_to_base64(&self, customer_id: &str, file_name: &str, page_index: u16) -> Result<String> {
        let pdfium_guard = get_pdfium!();
        let pdfium = &pdfium_guard.0;

        let mut path = self.base_path.join(customer_id).join("original_files").join(file_name);
        if !path.exists() {
            path = self.base_path.join(customer_id).join("merged").join(file_name);
        }

        let doc = pdfium.load_pdf_from_file(&path, None)?;
        let page = doc.pages().get(page_index).context("Bad page index")?;

        let bitmap = page.render(300, 400, None)?;
        let img = bitmap.as_image();
        
        let mut buf = std::io::Cursor::new(Vec::new());
        img.write_to(&mut buf, image::ImageFormat::Png)?;
        
        use base64::{Engine as _, engine::general_purpose};
        Ok(format!("data:image/png;base64,{}", general_purpose::STANDARD.encode(buf.into_inner())))
    }

    pub fn get_customer_metadata(&self, customer_id: &str) -> Result<CustomerMetadata> {
        let path = self.base_path.join(customer_id).join("metadata.json");
        if !path.exists() { return Ok(CustomerMetadata::default()); }
        let s = fs::read_to_string(path)?;
        Ok(serde_json::from_str(&s)?)
    }

    pub fn save_customer_metadata(&self, customer_id: &str, meta: &CustomerMetadata) -> Result<()> {
        let path = self.base_path.join(customer_id).join("metadata.json");
        let s = serde_json::to_string_pretty(meta)?;
        fs::write(path, s)?;
        Ok(())
    }

    pub fn update_file_tags(&self, customer_id: &str, file_name: &str, tags: Vec<String>) -> Result<()> {
        let mut meta = self.get_customer_metadata(customer_id)?;
        meta.files.insert(file_name.to_string(), FileMetadata { tags });
        self.save_customer_metadata(customer_id, &meta)
    }

    fn append_image_to_pdf_internal(&self, _pdfium: &Pdfium, doc: &mut PdfDocument, image_path: &Path) -> Result<()> {
        let img = image::open(image_path)?;
        let (w, h) = img.dimensions();
        let scale = 595.0 / w as f32;
        let p_w = PdfPoints::new(595.0);
        let p_h = PdfPoints::new(h as f32 * scale);

        let size = PdfPagePaperSize::new_custom(p_w, p_h);
        let mut page = doc.pages_mut().create_page_at_end(size)?;
        
        // Convert to DynamicImage just to be safe, then to PdfPageImageObject
        let mut obj = PdfPageImageObject::new(doc, &img).map_err(|e| anyhow::anyhow!("PDFium error: {:?}", e))?;
        obj.scale(p_w.value, p_h.value).map_err(|e| anyhow::anyhow!("PDFium error on scale: {:?}", e))?;
        
        let object = PdfPageObject::Image(obj);
        page.objects_mut().add_object(object).map_err(|e| anyhow::anyhow!("PDFium error adding object: {:?}", e))?;
        Ok(())
    }

    pub fn copy_to_downloads(&self, customer_id: &str, file_name: &str) -> Result<String> {
        let mut source_path = self.base_path.join(customer_id).join("merged").join(file_name);
        if !source_path.exists() {
            source_path = self.base_path.join(customer_id).join("original_files").join(file_name);
        }
        if !source_path.exists() {
            return Err(anyhow::anyhow!("File not found"));
        }

        let download_dir = dirs::download_dir().ok_or_else(|| anyhow::anyhow!("Could not find Downloads directory"))?;
        
        let safe_name = self.generate_safe_filename(&download_dir, file_name);
        let dest_path = download_dir.join(&safe_name);
        
        fs::copy(&source_path, &dest_path)?;
        Ok(dest_path.to_string_lossy().to_string())
    }

    fn generate_safe_filename(&self, dir: &Path, original_name: &str) -> String {

        let name = sanitize(original_name);
        let path = Path::new(&name);
        let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("file");
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
        
        let mut candidate = name.clone();
        let mut count = 1;
        while dir.join(&candidate).exists() {
            candidate = if ext.is_empty() { format!("{} ({})", stem, count) } 
                        else { format!("{} ({}).{}", stem, count, ext) };
            count += 1;
        }
        candidate
    }

    fn prepare_native_upload_sources(&self, file_paths: Vec<String>) -> Result<Vec<NativeUploadSource>> {
        let mut seen = HashSet::new();
        let mut sources = Vec::new();

        for file_path in file_paths {
            let source = Path::new(&file_path);
            if !source.exists() {
                return Err(anyhow::anyhow!("Source file does not exist: {}", file_path));
            }

            let canonical_path = fs::canonicalize(source)
                .with_context(|| format!("Failed to resolve source file: {}", file_path))?;
            let metadata = fs::metadata(&canonical_path)?;
            if !metadata.is_file() {
                return Err(anyhow::anyhow!("Source path is not a file: {}", file_path));
            }

            let modified = metadata.modified()
                .ok()
                .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                .map(|duration| duration.as_millis())
                .unwrap_or_default();
            let identity = format!(
                "{}|{}|{}",
                canonical_path.to_string_lossy(),
                metadata.len(),
                modified,
            );

            if !seen.insert(identity.clone()) {
                continue;
            }

            let file_name = canonical_path.file_name()
                .and_then(|n| n.to_str())
                .ok_or_else(|| anyhow::anyhow!("Invalid filename"))?
                .to_string();

            sources.push(NativeUploadSource {
                identity,
                path: canonical_path,
                file_name,
            });
        }

        Ok(sources)
    }

    fn native_upload_batch_key(&self, customer_id: &str, sources: &[NativeUploadSource]) -> String {
        let mut identities: Vec<&str> = sources.iter().map(|source| source.identity.as_str()).collect();
        identities.sort_unstable();
        format!("{}::{}", customer_id, identities.join("::"))
    }

    fn try_begin_native_upload_batch(&self, batch_key: &str) -> bool {
        const NATIVE_UPLOAD_DEDUPE_WINDOW: Duration = Duration::from_secs(2);

        let now = Instant::now();
        let mut recent_batches = self.recent_native_upload_batches.lock();
        recent_batches.retain(|_, state| match state {
            NativeUploadBatchState::InFlight => true,
            NativeUploadBatchState::Completed { completed_at } => {
                now.duration_since(*completed_at) <= NATIVE_UPLOAD_DEDUPE_WINDOW
            }
        });

        if recent_batches.contains_key(batch_key) {
            return false;
        }

        recent_batches.insert(
            batch_key.to_string(),
            NativeUploadBatchState::InFlight,
        );
        true
    }

    fn finish_native_upload_batch(&self, batch_key: &str) {
        if let Some(state) = self.recent_native_upload_batches.lock().get_mut(batch_key) {
            *state = NativeUploadBatchState::Completed {
                completed_at: Instant::now(),
            };
        }
    }

    fn clear_native_upload_batch(&self, batch_key: &str) {
        self.recent_native_upload_batches.lock().remove(batch_key);
    }
}

struct NativeUploadSource {
    identity: String,
    path: PathBuf,
    file_name: String,
}

enum NativeUploadBatchState {
    InFlight,
    Completed { completed_at: Instant },
}

#[cfg(test)]
mod tests {
    use super::CustomerManager;
    use anyhow::Result;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn upload_from_paths_skips_duplicate_entries_in_same_batch() -> Result<()> {
        let temp_dir = tempdir()?;
        let manager = CustomerManager::new(temp_dir.path().join("customers"));
        manager.init()?;
        manager.create_customer("cust-1", "Customer")?;

        let source_path = temp_dir.path().join("document.pdf");
        fs::write(&source_path, b"test")?;

        let uploaded = manager.upload_from_paths(
            "cust-1",
            vec![
                source_path.to_string_lossy().to_string(),
                source_path.to_string_lossy().to_string(),
            ],
        )?;

        assert_eq!(uploaded, vec!["document.pdf".to_string()]);

        let stored_files = manager.list_original_files("cust-1")?;
        assert_eq!(stored_files, vec!["document.pdf".to_string()]);
        Ok(())
    }

    #[test]
    fn upload_from_paths_ignores_immediate_duplicate_batches() -> Result<()> {
        let temp_dir = tempdir()?;
        let manager = CustomerManager::new(temp_dir.path().join("customers"));
        manager.init()?;
        manager.create_customer("cust-1", "Customer")?;

        let source_path = temp_dir.path().join("document.pdf");
        fs::write(&source_path, b"test")?;

        let first_upload = manager.upload_from_paths(
            "cust-1",
            vec![source_path.to_string_lossy().to_string()],
        )?;
        let duplicate_upload = manager.upload_from_paths(
            "cust-1",
            vec![source_path.to_string_lossy().to_string()],
        )?;

        assert_eq!(first_upload, vec!["document.pdf".to_string()]);
        assert!(duplicate_upload.is_empty());

        let stored_files = manager.list_original_files("cust-1")?;
        assert_eq!(stored_files, vec!["document.pdf".to_string()]);
        Ok(())
    }
}

    pub fn get_pdf_metadata(&self, customer_id: &str, file_name: &str) -> Result<super::commands::PdfMetadata> {
        let file_path = self.base_path.join(customer_id).join("original_files").join(file_name);
        if !file_path.exists() {
            anyhow::bail!("File not found: {}", file_name);
        }
        
        let file_size = fs::metadata(&file_path)?.len();
        let file_name = file_name.to_string();
        
        // Try to extract PDF metadata using pdfium
        let pdfium = PDFIUM.lock().unwrap();
        if let Ok(ref pdfium) = *pdfium {
            if let Ok(doc) = pdfium.0.load_pdf_from_file(&file_path, None) {
                let page_count = doc.pages().len();
                let title = doc.title().map(|s| s.to_string());
                let author = doc.author().map(|s| s.to_string());
                let creator = doc.creator().map(|s| s.to_string());
                let producer = doc.producer().map(|s| s.to_string());
                let created = doc.creation_date().map(|d| d.to_string());
                let modified = doc.mod_date().map(|d| d.to_string());
                
                return Ok(super::commands::PdfMetadata {
                    title, author, creator, producer,
                    page_count, created, modified,
                    file_size, file_name,
                });
            }
        }
        
        // Fallback: basic info without pdfium parsing
        if file_path.extension().map_or(false, |e| e == "pdf") {
            let buf = fs::read(&file_path)?;
            let page_count = Self::count_pdf_pages_fallback(&buf);
            return Ok(super::commands::PdfMetadata {
                title: None, author: None, creator: None, producer: None,
                page_count, created: None, modified: None,
                file_size, file_name,
            });
        }
        
        Ok(super::commands::PdfMetadata {
            title: None, author: None, creator: None, producer: None,
            page_count: 0, created: None, modified: None,
            file_size, file_name,
        })
    }
    
    fn count_pdf_pages_fallback(buf: &[u8]) -> usize {
        // Simple /Type /Page count as fallback when pdfium can't open
        let text = String::from_utf8_lossy(buf);
        text.matches("/Type /Page").count()
    }
