#!/bin/bash
cd "$(dirname "$0")"
clear
echo "=========================================================="
echo "  KAUAI SOUTH SHORE MARINE REPORT DASHBOARD DIRECT LAUNCH"
echo "=========================================================="
echo ""
echo "1. Pre-fetching latest wind and marine data..."
python3 scripts/fetch_data.py
echo ""
echo "2. Opening dashboard in your default browser..."
open "http://localhost:8080"
echo ""
echo "3. Starting local web server (keep this window open)..."
echo "   (Press Ctrl+C in this terminal window to stop the server)"
echo ""
python3 scripts/server.py
