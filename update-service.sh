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
echo "[1/5] Pulling latest changes from git..."
SCRIPT_BEFORE=$(md5sum "$0")
git pull
echo "✓ Git pull complete"
echo ""

# If this script itself changed, re-exec the new version and let it finish
SCRIPT_AFTER=$(md5sum "$0")
if [[ "$SCRIPT_BEFORE" != "$SCRIPT_AFTER" ]]; then
  echo "↻ update-service.sh changed — re-running updated script..."
  exec "$0" "$@"
fi
echo ""

# Step 2: Install dependencies
echo "[2/5] Installing dependencies..."
npm ci
echo "✓ Dependencies installed"
echo ""

# Step 3: Build
echo "[3/5] Building application..."
npm run build
echo "✓ Build complete"
echo ""

# Step 4: Fix permissions
echo "[4/5] Fixing file permissions..."
sudo chown -R todash:users .
echo "✓ Permissions fixed"
echo ""

# Step 5: Restart service
echo "[5/5] Restarting todash service..."
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

