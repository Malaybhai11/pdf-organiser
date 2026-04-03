use std::fs;
use std::path::{Path, PathBuf};
use anyhow::{Result, Context};
use sanitize_filename::sanitize;

pub struct CustomerManager {
    base_path: PathBuf,
}

impl CustomerManager {
    /// Creates a new CustomerManager from a base path.
    pub fn new(base_path: PathBuf) -> Self {
        Self { base_path }
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

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_customer_creation() -> Result<()> {
        let tmp = tempdir()?;
        let manager = CustomerManager::new(tmp.path().to_path_buf());
        manager.create_customer("test_id")?;
        
        assert!(tmp.path().join("test_id/original_files").exists());
        assert!(tmp.path().join("test_id/merged").exists());
        Ok(())
    }

    #[test]
    fn test_file_collision() -> Result<()> {
        let tmp = tempdir()?;
        let manager = CustomerManager::new(tmp.path().to_path_buf());
        let customer_id = "test_user";
        manager.create_customer(customer_id)?;
        
        let data = b"hello".to_vec();
        let name1 = manager.save_original_file(customer_id, "doc.pdf", data.clone())?;
        let name2 = manager.save_original_file(customer_id, "doc.pdf", data.clone())?;
        
        assert_eq!(name1, "doc.pdf");
        assert_eq!(name2, "doc (1).pdf");
        Ok(())
    }
}
