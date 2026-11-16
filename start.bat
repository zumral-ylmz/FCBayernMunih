@echo off
rem Starts 12th Coach and opens it in the browser. Close this window to stop it.
start "" /b cmd /c "timeout /t 2 >nul & start http://localhost:8000"
python server.py
pause
