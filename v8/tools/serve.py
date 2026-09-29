#!/usr/bin/env python3
"""Sturdy local static server for QA: big listen backlog + threads (the stock http.server drops
connections when several headless browsers load ~30 MB of assets at once). Usage: serve.py [root] [port]"""
import http.server, os, sys
root = sys.argv[1] if len(sys.argv) > 1 else "."
port = int(sys.argv[2]) if len(sys.argv) > 2 else 8811
os.chdir(root)
class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
    def log_message(self, *a): pass
class Server(http.server.ThreadingHTTPServer):
    request_queue_size = 512
    daemon_threads = True
Server(("127.0.0.1", port), Handler).serve_forever()
