#!/bin/bash

# Todash Service Update Script
# This script updates the todash service by pulling latest code, building, and restarting

set -e  # Exit on any error

echo "========================================="
echo "Todash Service Update Script"
echo "========================================="
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "Working directory: $SCRIPT_DIR"
echo ""

# Step 1: Git pull
echo "[1/4] Pulling latest changes from git..."
git pull
echo "✓ Git pull complete"
echo ""

# Step 2: Build
echo "[2/4] Building application..."
npm run build
echo "✓ Build complete"
echo ""

# Step 3: Fix permissions
echo "[3/4] Fixing file permissions..."
sudo chown -R todash:users .
echo "✓ Permissions fixed"
echo ""

# Step 4: Restart service
echo "[4/4] Restarting todash service..."
sudo systemctl restart todash
echo "✓ Service restarted"
echo ""

# Check service status
echo "Checking service status..."
sleep 2
if sudo systemctl is-active --quiet todash; then
    echo "✓ Service is running"
    echo ""
    echo "========================================="
    echo "Update completed successfully!"
    echo "========================================="
    exit 0
else
    echo "✗ Service failed to start!"
    echo ""
    echo "Service status:"
    sudo systemctl status todash --no-pager
    echo ""
    echo "Recent logs:"
    sudo journalctl -u todash -n 20 --no-pager
    exit 1
fi

