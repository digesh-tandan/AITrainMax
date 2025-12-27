@echo off
title AI TrainMax - One Click Starter
color 0a

echo =============================================
echo       🚄 AI TRAINMAX  - AUTO STARTER 🚄
echo =============================================
echo.

REM --------- BACKEND START ---------
echo 👉 Starting Backend Server...
start cmd /k "cd /d backend && venv\Scripts\activate && python app.py"

REM --------- WAIT A LITTLE ---------
timeout /t 3 >nul

REM --------- FRONTEND START ---------
echo 👉 Starting Frontend React App...
start cmd /k "cd /d frontend && npm start"

echo.
echo =============================================
echo  ✅ All systems running!
echo  Backend → 127.0.0.1:5000
echo  Frontend → http://localhost:3000
echo =============================================
echo.

exit
