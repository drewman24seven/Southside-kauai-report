#!/usr/bin/env python3
"""
Simple HTTP Server for Kauai South Shore Marine Dashboard.
Serves dashboard files locally and handles POST /refresh requests.
"""
import os
import sys
import subprocess
from http.server import SimpleHTTPRequestHandler, HTTPServer

PORT = 8080
WORKSPACE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class DashboardHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Always serve from workspace directory
        super().__init__(*args, directory=WORKSPACE_DIR, **kwargs)

    def do_POST(self):
        if self.path == '/refresh':
            print("Received refresh request. Fetching marine data...")
            try:
                # Execute fetch_data.py script to update data.json
                fetch_script = os.path.join(WORKSPACE_DIR, "scripts", "fetch_data.py")
                res = subprocess.run(
                    ["python3", fetch_script],
                    capture_output=True, text=True, check=True
                )
                print(res.stdout)
                
                # Send success response
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success"}).encode('utf-8'))
            except Exception as e:
                print(f"Error running fetch aggregator: {e}", file=sys.stderr)
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

# Import json only inside handler if needed, or globally
import json

def main():
    # Change working dir to workspace
    os.chdir(WORKSPACE_DIR)
    
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, DashboardHandler)
    print(f"===========================================================")
    print(f"  Kauai South Shore Marine Dashboard Server Started!        ")
    print(f"  Access the dashboard at: http://localhost:{PORT}          ")
    print(f"===========================================================")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.server_close()
        sys.exit(0)

if __name__ == "__main__":
    main()
