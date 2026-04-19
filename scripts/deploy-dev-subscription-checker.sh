#!/bin/bash

# Development Subscription Checker Deployment Script
# This script deploys and manages the PM2 subscription checker for development environment

set -e

echo "=== StaffSync Dev Subscription Checker Deployment ==="

# Configuration
APP_DIR="/var/www/staffsync"
LOGS_DIR="$APP_DIR/logs"
PM2_CONFIG="ecosystem-dev-subscription-checker.config.js"

echo "Working directory: $APP_DIR"
echo "Logs directory: $LOGS_DIR"

# Create logs directory if it doesn't exist
echo "Creating logs directory..."
mkdir -p "$LOGS_DIR"

# Navigate to app directory
cd "$APP_DIR"

# Stop existing dev subscription checker if running
echo "Stopping existing dev subscription checker..."
pm2 stop staffsync-dev-subscription-checker || echo "No existing dev process to stop"

# Start the dev subscription checker
echo "Starting dev subscription checker with PM2..."
pm2 start "$PM2_CONFIG" --env development

# Show status
echo "PM2 Status:"
pm2 status

# Save PM2 configuration
echo "Saving PM2 configuration..."
pm2 save

echo "=== Dev Subscription Checker Deployment Complete ==="
echo ""
echo "Dev Schedule: Every 6 hours (0 */6 * * *)"
echo ""
echo "To check logs:"
echo "  pm2 logs staffsync-dev-subscription-checker"
echo ""
echo "To view dev subscription checker logs:"
echo "  tail -f $LOGS_DIR/dev-subscription-checker.log"
echo ""
echo "To restart manually:"
echo "  pm2 restart staffsync-dev-subscription-checker"
echo ""
echo "To stop:"
echo "  pm2 stop staffsync-dev-subscription-checker"
echo ""
echo "To test manually:"
echo "  npm run subscription:check"
