# ESP32 Display — Web File Manager

React-based file manager for the ESP32 display device. Allows uploading, viewing, and managing images on the SD card via a web interface.

## Development

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Build & Deploy

```bash
npm run build
```

This builds the React app into `../components/react_spa/dist/`, which is served by the ESPHome `react_spa` component on port 80.

## Features

- **File Upload**: Drag-and-drop or click to upload PNG, JPG, GIF images
- **File List**: Browse all images on SD card with file size
- **Delete**: Remove files from SD card
- **Auto-refresh**: Refresh the file list with one click
- **Responsive**: Works on desktop and mobile browsers

## API Endpoints

The device provides these endpoints (implemented in the custom component):

- `GET /api/status` — Check device connectivity
- `GET /api/files` — List all files on SD card
- `POST /api/files` — Upload a file (multipart/form-data)
- `DELETE /api/files?path=<path>` — Delete a file
