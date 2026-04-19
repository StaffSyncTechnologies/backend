#!/bin/bash

# Subscription Checker Deployment Script
# This script deploys and manages the PM2 subscription checker cron job

set -e

echo "=== StaffSync Subscription Checker Deployment ==="

# Configuration
APP_DIR="/var/www/staffsync"
LOGS_DIR="$APP_DIR/logs"
PM2_CONFIG="ecosystem-subscription-checker.config.js"

echo "Working directory: $APP_DIR"
echo "Logs directory: $LOGS_DIR"

# Create logs directory if it doesn't exist
echo "Creating logs directory..."
mkdir -p "$LOGS_DIR"

# Navigate to app directory
cd "$APP_DIR"

# Stop existing subscription checker if running
echo "Stopping existing subscription checker..."
pm2 stop staffsync-subscription-checker || echo "No existing process to stop"

# Start the subscription checker
echo "Starting subscription checker with PM2..."
pm2 start "$PM2_CONFIG" --env production

# Show status
echo "PM2 Status:"
pm2 status

# Save PM2 configuration
echo "Saving PM2 configuration..."
pm2 save

# Setup PM2 to start on system reboot (if not already set up)
echo "Setting up PM2 startup..."
pm2 startup | tail -1 | bash || echo "PM2 startup already configured"

echo "=== Subscription Checker Deployment Complete ==="
echo ""
echo "To check logs:"
echo "  pm2 logs staffsync-subscription-checker"
echo ""
echo "To view subscription checker logs:"
echo "  tail -f $LOGS_DIR/subscription-checker.log"
echo ""
echo "To restart manually:"
echo "  pm2 restart staffsync-subscription-checker"
echo ""
echo "To stop:"
echo "  pm2 stop staffsync-subscription-checker"
