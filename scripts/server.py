#!/usr/bin/env python3
"""
Simple HTTP Server for Kauai South Shore Marine Dashboard.
Serves dashboard files locally and handles POST /refresh requests.
"""
import os
import sys
import subprocess
from http.server import SimpleHTTPRequestHandler, HTTPServer

import threading
import time

PORT = 8082
WORKSPACE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def background_fetch_loop():
    fetch_script = os.path.join(WORKSPACE_DIR, "scripts", "fetch_data.py")
    while True:
        try:
            print("Running background fetch_data.py...")
            subprocess.run(["python3", fetch_script], capture_output=True, text=True, check=True)
            print("Background fetch completed successfully.")
        except Exception as e:
            print(f"Background fetch error: {e}", file=sys.stderr)
        time.sleep(600)  # Wait 10 minutes

# Start the background fetch thread
fetch_thread = threading.Thread(target=background_fetch_loop, daemon=True)
fetch_thread.start()

class DashboardHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Always serve from workspace directory
        super().__init__(*args, directory=WORKSPACE_DIR, **kwargs)

    def do_GET(self):
        from urllib.parse import urlparse, parse_qs
        parsed_path = urlparse(self.path)
        if parsed_path.path == '/api/conditions':
            query = parse_qs(parsed_path.query)
            island = query.get('island', ['kauai'])[0]
            shore = query.get('shore', ['south'])[0]
            
            data_file = os.path.join(WORKSPACE_DIR, "data.json")
            try:
                with open(data_file, 'r', encoding='utf-8') as f:
                    master_data = json.load(f)
                
                # Build scoped payload
                scoped_data = {
                    "last_updated": master_data.get("last_updated"),
                    "forecast_text": master_data.get("forecast_text"),
                    "tides": master_data.get("tides", {}),
                    "swell": master_data.get("swell", {})
                }
                
                island_data = master_data.get("islands", {}).get(island, {})
                if island_data:
                    scoped_data["forecast_text"] = island_data.get("forecast_text", scoped_data["forecast_text"])
                    shore_data = island_data.get("shores", {}).get(shore, {})
                    if shore_data:
                        scoped_data["tides"] = shore_data.get("tides", scoped_data["tides"])
                        scoped_data["swell"] = shore_data.get("swell", scoped_data["swell"])
                        scoped_data["model_wind"] = shore_data.get("model_wind")
                        scoped_data["wind"] = shore_data.get("wind")
                        scoped_data["shadowDecay"] = shore_data.get("shadowDecay")
                        scoped_data["extra_winds"] = shore_data.get("extra_winds")
                        # Add extra data that might be needed by the specific shore
                        if "swell_51208" in master_data:
                            scoped_data["swell_51208"] = master_data["swell_51208"]
                        
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps(scoped_data).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        else:
            super().do_GET()

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
