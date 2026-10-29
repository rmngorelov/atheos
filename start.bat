@echo off
rem Serves the Atheos web copy at http://127.0.0.1:8765 and opens it in your browser.
rem Close this window (or press Ctrl+C) to stop the server.
cd /d "%~dp0"
start "" cmd /c "timeout /t 1 /nobreak >nul & start http://127.0.0.1:8765/"
python -m http.server 8765 --bind 127.0.0.1
