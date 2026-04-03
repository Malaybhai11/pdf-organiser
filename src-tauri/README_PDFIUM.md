# PDFium Binary Setup Instructions

The `pdfium-render` library requires the PDFium native library to be available on your system. 

### 1. Download Binaries
Go to the [bblanchon/pdfium-binaries](https://github.com/bblanchon/pdfium-binaries/releases) repository and download the appropriate release for your operating system:

- **Windows**: `pdfium-win-x64.tgz`
- **Linux**: `pdfium-linux-x64.tgz`
- **macOS**: `pdfium-apple-universal.tgz`

### 2. Extract and Place
1. Create a `bin` directory in `src-tauri/`:
   `mkdir src-tauri/bin`
2. Extract the downloaded archive.
3. Locate the library file:
   - **Windows**: `pdfium.dll`
   - **Linux**: `libpdfium.so`
   - **macOS**: `libpdfium.dylib`
4. Copy this file into `src-tauri/bin/`.

### 3. Tauri Configuration
Ensure `tauri.conf.json` includes the `bin` directory as a resource so it's packaged with the app.

```json
{
  "bundle": {
    "resources": ["bin/*"]
  }
}
```

### 4. Technical Note
The Rust code is configured to load PDFium from the following paths at runtime:
- Development: `src-tauri/bin/`
- Production: The application's resource directory.
