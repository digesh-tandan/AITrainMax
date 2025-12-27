#!/bin/bash
# run_server.sh: Setup and execution script for the Flask backend.

# --- Configuration ---
FLASK_APP_NAME="app.py"
VENV_DIR="venv"
PORT=5000
HOST="0.0.0.0"

# --- 1. Navigate to the backend directory ---
# This ensures the script can find app.py and the data files are accessible by Flask
echo "Navigating to the backend directory..."
cd "$(dirname "$0")" || { echo "Error: Failed to navigate to backend directory."; exit 1; }

# --- 2. Create and Activate Virtual Environment ---
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv "$VENV_DIR"
fi

echo "Activating virtual environment..."
source "$VENV_DIR/bin/activate"

# Check if activation was successful
if [ $? -ne 0 ]; then
    echo "ERROR: Could not activate the virtual environment. Ensure python3 is installed."
    exit 1
fi

# --- 3. Install/Update Dependencies ---
if [ -f "requirements.txt" ]; then
    echo "Installing/Updating dependencies from requirements.txt..."
    pip install --upgrade pip
    pip install -r requirements.txt
    
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to install Python dependencies. Aborting."
        deactivate
        exit 1
    fi
else
    echo "Warning: requirements.txt not found. Skipping dependency installation."
fi

# --- 4. Set Environment Variables ---
echo "Setting Flask environment variables..."
export FLASK_APP="$FLASK_APP_NAME"
# Use 'development' for verbose debugging; switch to 'production' for final deployment
export FLASK_ENV=development 
# Prevents Python buffering output, ensuring real-time logs in the terminal
export PYTHONUNBUFFERED=TRUE

# --- 5. Run the Flask Application ---
echo "=========================================================="
echo "Starting Flask Railway Command Center server..."
echo "Access at: http://$HOST:$PORT"
echo "=========================================================="

# Use 'exec' to replace the current shell process with the Flask process.
# This ensures graceful signal handling (like Ctrl+C).
exec flask run --host="$HOST" --port="$PORT"

# The script execution stops here. The 'deactivate' step is handled manually 
# after the user stops the server, or by the shell's exit command.