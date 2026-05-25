#!/usr/bin/env python3
"""
Minimal paste-image server.
GET  any path → serves the paste HTML page
POST any path → accepts { "data": "data:image/png;base64,..." }
               saves to /tmp/claude_paste.png and returns {"ok": true}
"""
import base64
import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

SAVE_PATH = "/tmp/claude_paste.png"

HTML = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Paste Image - Claude</title>
<style>
  body { font-family: sans-serif; display: flex; flex-direction: column;
         align-items: center; justify-content: center; height: 100vh;
         margin: 0; background: #1e1e2e; color: #cdd6f4; }
  #zone { width: 480px; height: 280px; border: 3px dashed #89b4fa;
          border-radius: 12px; display: flex; align-items: center;
          justify-content: center; font-size: 1.2rem; cursor: pointer;
          transition: background .2s; }
  #zone.ready { background: #1e3a5f; border-color: #a6e3a1; }
  #preview { max-width: 480px; max-height: 280px; margin-top: 16px;
             border-radius: 8px; display: none; }
  #status { margin-top: 12px; font-size: .95rem; color: #a6e3a1; }
</style>
</head>
<body>
<h2>Paste Image for Claude</h2>
<div id="zone">Click here, then press Ctrl+V</div>
<img id="preview">
<div id="status"></div>
<script>
const zone = document.getElementById('zone');
const preview = document.getElementById('preview');
const status = document.getElementById('status');

zone.addEventListener('click', () => zone.focus());
zone.setAttribute('tabindex', '0');

document.addEventListener('paste', async (e) => {
  const item = [...e.clipboardData.items].find(i => i.type.startsWith('image/'));
  if (!item) { status.textContent = 'No image found in clipboard.'; return; }

  const blob = item.getAsFile();
  const reader = new FileReader();
  reader.onload = async () => {
    preview.src = reader.result;
    preview.style.display = 'block';
    status.textContent = 'Uploading...';
    zone.classList.add('ready');

    // Build upload URL relative to current page location
    const base = window.location.href.replace(/[?#].*$/, '').replace(/\\/$/, '');
    const uploadUrl = base + '/upload';
    status.textContent = 'Uploading to: ' + uploadUrl;

    try {
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: reader.result }),
      });
      const json = await res.json();
      status.textContent = json.ok ? 'Saved! Claude can now read it.' : 'Upload failed';
    } catch(err) {
      status.textContent = 'Error: ' + err.message;
    }
  };
  reader.readAsDataURL(blob);
});
</script>
</body>
</html>
"""


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        import sys
        print(f"[paste-server] {self.command} {self.path}", flush=True, file=sys.stderr)

    def do_GET(self):
        body = HTML.encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        payload = json.loads(self.rfile.read(length))
        data_url = payload.get("data", "")
        _, b64 = data_url.split(",", 1)
        with open(SAVE_PATH, "wb") as f:
            f.write(base64.b64decode(b64))
        body = json.dumps({"ok": True}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    port = int(os.environ.get("PASTE_PORT", 3011))
    print(f"paste-server listening on :{port}", flush=True)
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()
