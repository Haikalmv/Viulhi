"""Local development server for Viulhi.

Like `python -m http.server`, but tells the browser not to cache anything,
so a normal refresh always shows your latest changes.

Run from the viulhi folder:   python serve.py        (then open http://localhost:8000)
Optional port:                python serve.py 8080
"""
import http.server
import os
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f"Viulhi running at http://localhost:{port}  (Ctrl+C to stop)")
    http.server.ThreadingHTTPServer(("", port), NoCacheHandler).serve_forever()
