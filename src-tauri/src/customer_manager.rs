use std::fs;
pub use std::path::{Path, PathBuf};
use std::sync::{Arc};
use parking_lot::Mutex;
use anyhow::{Result, Context};
use sanitize_filename::sanitize;
use pdfium_render::prelude::*;
use image::{GenericImageView, DynamicImage};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// We use an unsafe wrapper because Pdfium is not Send, but we will ensure 
// serial access via a global Mutex. This is more efficient than re-binding on each call.
struct PdfiumWrapper(Pdfium);
unsafe impl Send for PdfiumWrapper {}

static PDFIUM: Lazy<Mutex<PdfiumWrapper>> = Lazy::new(|| {
    // Attempt to bind to a local platform-specific library first, then system
    let pdfium = Pdfium::bind_to_library(Pdfium::pdfium_platform_library_name_at_path("./bin"))
        .or_else(|_| Pdfium::bind_to_system_library())
        .expect("Failed to bind to PDFium library. Ensure pdfium.dll/so is available.");
    Mutex::new(PdfiumWrapper(pdfium))
});

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
}

impl CustomerManager {
    pub fn new(base_path: PathBuf) -> Self {
        Self { base_path }
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
                results.push(Customer { id, name: if meta.name.is_empty() { id.clone() } else { meta.name } });
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

    pub fn list_original_files(&self, customer_id: &str) -> Result<Vec<String>> {
        let mut files = Vec::new();
        
        // Check original_files
        let original_dir = self.base_path.join(customer_id).join("original_files");
        if original_dir.exists() {
            for entry in fs::read_dir(original_dir)? {
                let entry = entry?;
                if let Some(name) = entry.file_name().to_str() {
                    files.push(name.to_string());
                }
            }
        }

        // Check merged
        let merged_dir = self.base_path.join(customer_id).join("merged");
        if merged_dir.exists() {
            for entry in fs::read_dir(merged_dir)? {
                let entry = entry?;
                if let Some(name) = entry.file_name().to_str() {
                    files.push(name.to_string());
                }
            }
        }
        
        Ok(files)
    }

    pub fn merge_documents<F>(&self, customer_id: &str, file_names: Vec<String>, progress: F) -> Result<String> 
    where F: Fn(String) {
        let pdfium_guard = PDFIUM.lock();
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
                master_doc.pages().copy_page_range_from_document(&src, 0..(src.pages().len()), master_doc.pages().len())?;
            } else if matches!(ext.as_str(), "jpg" | "jpeg" | "png") {
                self.append_image_to_pdf_internal(pdfium, &mut master_doc, &path)?;
            }
        }

        let output_path = merged_dir.join("final.pdf");
        master_doc.save_to_file(&output_path)?;
        Ok("final.pdf".to_string())
    }

    pub fn extract_pages(&self, customer_id: &str, file_name: &str, page_indices: Vec<u16>) -> Result<String> {
        let pdfium_guard = PDFIUM.lock();
        let pdfium = &pdfium_guard.0;

        let mut source_path = self.base_path.join(customer_id).join("original_files").join(file_name);
        if !source_path.exists() {
             source_path = self.base_path.join(customer_id).join("merged").join(file_name);
        }

        let src = pdfium.load_pdf_from_file(&source_path, None)?;
        let mut new_doc = pdfium.create_new_pdf()?;

        for &idx in &page_indices {
            if idx < src.pages().len() {
                new_doc.pages().copy_page_range_from_document(&src, idx..=idx, new_doc.pages().len())?;
            }
        }

        let output_name = format!("extracted_{}", file_name);
        let output_path = self.base_path.join(customer_id).join("merged").join(&output_name);
        new_doc.save_to_file(&output_path)?;
        Ok(output_name)
    }

    pub fn get_pdf_page_count(&self, customer_id: &str, file_name: &str) -> Result<u16> {
        let pdfium_guard = PDFIUM.lock();
        let pdfium = &pdfium_guard.0;

        let mut path = self.base_path.join(customer_id).join("original_files").join(file_name);
        if !path.exists() {
            path = self.base_path.join(customer_id).join("merged").join(file_name);
        }
        
        let doc = pdfium.load_pdf_from_file(&path, None)?;
        Ok(doc.pages().len())
    }

    pub fn render_pdf_page_to_base64(&self, customer_id: &str, file_name: &str, page_index: u16) -> Result<String> {
        let pdfium_guard = PDFIUM.lock();
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

    fn append_image_to_pdf_internal(&self, pdfium: &Pdfium, doc: &mut PdfDocument, image_path: &Path) -> Result<()> {
        let img = image::open(image_path)?;
        let (w, h) = img.dimensions();
        let scale = 595.0 / w as f32;
        let p_w = PdfPoints::new(595.0);
        let p_h = PdfPoints::new(h as f32 * scale);

        let mut page = doc.pages_mut().create_page_at_end(p_w, p_h)?;
        let mut bitmap = PdfBitmap::new(w as i32, h as i32, PdfBitmapFormat::BGRA, None)?;

        for (x, y, pixel) in img.pixels() {
            bitmap.set_pixel_at_pos(x as i32, y as i32, pixel[2], pixel[1], pixel[0], pixel[3])?;
        }

        let mut obj = pdfium_render::prelude::PdfPageObject::new_image_object_from_bitmap(&bitmap)?;
        obj.scale(p_w.value as f64, p_h.value as f64)?;
        page.objects_mut().add_image_object(obj)?;
        Ok(())
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
}
