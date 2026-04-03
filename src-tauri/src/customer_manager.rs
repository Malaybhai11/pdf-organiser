use std::fs;
use std::path::{Path, PathBuf};
use anyhow::{Result, Context};
use sanitize_filename::sanitize;
use pdfium_render::prelude::*;
use image::GenericImageView;

pub struct CustomerManager {
    base_path: PathBuf,
    pdfium_path: PathBuf,
}

impl CustomerManager {
    /// Creates a new CustomerManager.
    /// pdfium_path should point to the directory containing pdfium.dll/libpdfium.so
    pub fn new(base_path: PathBuf, pdfium_path: PathBuf) -> Self {
        Self { base_path, pdfium_path }
    }

    /// Ensures the base customers directory exists.
    pub fn init(&self) -> Result<()> {
        if !self.base_path.exists() {
            fs::create_dir_all(&self.base_path)
                .context("Failed to create base customers directory")?;
        }
        Ok(())
    }

    /// Creates customer folders structure: /customers/{id}/original_files/ and /customers/{id}/merged/
    pub fn create_customer(&self, customer_id: &str) -> Result<()> {
        let customer_dir = self.base_path.join(customer_id);
        fs::create_dir_all(customer_dir.join("original_files"))?;
        fs::create_dir_all(customer_dir.join("merged"))?;
        Ok(())
    }

    /// Saves a file into the customer's original_files directory with collision prevention.
    pub fn save_original_file(&self, customer_id: &str, file_name: &str, data: Vec<u8>) -> Result<String> {
        let target_dir = self.base_path.join(customer_id).join("original_files");
        
        if !target_dir.exists() {
            return Err(anyhow::anyhow!("Customer '{}' directory does not exist", customer_id));
        }

        let safe_name = self.generate_safe_filename(&target_dir, file_name);
        let target_path = target_dir.join(&safe_name);
        
        fs::write(&target_path, data)
            .with_context(|| format!("Failed to write file to {:?}", target_path))?;
            
        Ok(safe_name)
    }

    /// Lists all files in the customer's original_files directory.
    pub fn list_original_files(&self, customer_id: &str) -> Result<Vec<String>> {
        let target_dir = self.base_path.join(customer_id).join("original_files");
        
        if !target_dir.exists() {
            return Ok(Vec::new());
        }

        let mut files = Vec::new();
        for entry in fs::read_dir(target_dir)? {
            let entry = entry?;
            if entry.path().is_file() {
                if let Some(name) = entry.file_name().to_str() {
                    files.push(name.to_string());
                }
            }
        }
        Ok(files)
    }

    /// Lists all customer IDs (directories in the base path).
    pub fn list_customers(&self) -> Result<Vec<String>> {
        if !self.base_path.exists() {
            return Ok(Vec::new());
        }

        let mut customers = Vec::new();
        for entry in fs::read_dir(&self.base_path)? {
            let entry = entry?;
            if entry.path().is_dir() {
                if let Some(name) = entry.file_name().to_str() {
                    customers.push(name.to_string());
                }
            }
        }
        Ok(customers)
    }

    /// Merges multiple PDFs and images into a single final.pdf.
    /// The progress closure allows reporting status back to the caller.
    pub fn merge_documents<F>(&self, customer_id: &str, file_names: Vec<String>, progress: F) -> Result<String> 
    where F: Fn(String) {
        let pdfium = Pdfium::bind_to_library(Pdfium::pdfium_platform_library_name_at_path(&self.pdfium_path))
            .or_else(|_| Pdfium::bind_to_system_library())
            .context("Failed to bind to PDFium library")?;

        let mut master_doc = pdfium.create_new_pdf()
            .context("Failed to create master PDF document")?;

        let original_dir = self.base_path.join(customer_id).join("original_files");
        let merged_dir = self.base_path.join(customer_id).join("merged");
        fs::create_dir_all(&merged_dir)?;

        for (index, file_name) in file_names.iter().enumerate() {
            progress(format!("Processing {} ({} of {})", file_name, index + 1, file_names.len()));
            
            let file_path = original_dir.join(file_name);
            let ext = file_path.extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();

            if ext == "pdf" {
                let source_doc = pdfium.load_pdf_from_file(&file_path, None)?;
                master_doc.pages().copy_page_range_from_document(&source_doc, 0..(source_doc.pages().len()), master_doc.pages().len())?;
            } else if ext == "jpg" || ext == "jpeg" || ext == "png" {
                self.append_image_to_pdf(&mut master_doc, &file_path)?;
            }
        }

        let output_path = merged_dir.join("final.pdf");
        master_doc.save_to_file(&output_path)?;

        Ok("final.pdf".to_string())
    }

    /// Extracts selected pages from a PDF.
    pub fn extract_pages(&self, customer_id: &str, file_name: &str, page_indices: Vec<u16>) -> Result<String> {
        let pdfium = Pdfium::bind_to_library(Pdfium::pdfium_platform_library_name_at_path(&self.pdfium_path))
            .or_else(|_| Pdfium::bind_to_system_library())?;

        let source_path = self.base_path.join(customer_id).join("original_files").join(file_name);
        let source_doc = pdfium.load_pdf_from_file(&source_path, None)?;
        
        let mut new_doc = pdfium.create_new_pdf()?;
        
        for &page_idx in &page_indices {
            if page_idx < source_doc.pages().len() {
                new_doc.pages().copy_page_range_from_document(&source_doc, page_idx..=page_idx, new_doc.pages().len())?;
            }
        }

        let output_name = format!("extracted_{}", file_name);
        let output_path = self.base_path.join(customer_id).join("merged").join(&output_name);
        new_doc.save_to_file(&output_path)?;

        Ok(output_name)
    }

    fn append_image_to_pdf(&self, doc: &mut PdfDocument, image_path: &Path) -> Result<()> {
        let img = image::open(image_path)?;
        let (width, height) = img.dimensions();

        // Create a new page matching image aspect ratio (using points, 1/72 inch)
        // We'll scale it to a reasonable size, e.g., max 595 (A4 width)
        let scale = 595.0 / width as f32;
        let p_width = PdfPoints::new(595.0);
        let p_height = PdfPoints::new(height as f32 * scale);

        let mut page = doc.pages_mut().create_page_at_end(p_width, p_height)?;
        
        // Load image as bitmap and insert into page
        let mut bitmap = PdfBitmap::new(width as i32, height as i32, PdfBitmapFormat::BGRA, None)?;
        for (x, y, pixel) in img.pixels() {
            bitmap.set_pixel_at_pos(x as i32, y as i32, pixel[2], pixel[1], pixel[0], pixel[3])?;
        }

        let mut image_object = pdfium_render::prelude::PdfPageObject::new_image_object_from_bitmap(&bitmap)?;
        image_object.scale(p_width.value as f64, p_height.value as f64)?;
        page.objects_mut().add_image_object(image_object)?;
        
        Ok(())
    }

    /// Sanitizes and prevents overwriting by appending (1), (2), etc.
    fn generate_safe_filename(&self, dir: &Path, original_name: &str) -> String {
        let name = sanitize(original_name);
        let path = Path::new(&name);
        let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("file");
        let extension = path.extension().and_then(|e| e.to_str()).unwrap_or("");

        let mut candidate = name.clone();
        let mut count = 1;

        while dir.join(&candidate).exists() {
            candidate = if extension.is_empty() {
                format!("{} ({})", stem, count)
            } else {
                format!("{} ({}).{}", stem, count, extension)
            };
            count += 1;
        }

        candidate
    }
}
