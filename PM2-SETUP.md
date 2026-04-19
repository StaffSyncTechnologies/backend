# PM2 Subscription Checker Setup Guide

## Overview
This setup uses PM2 to manage the subscription checker as a cron job that runs daily at 9 AM UTC.

## Files Created

### 1. `ecosystem.config.js` (Updated)
- Main PM2 configuration file
- Contains both the backend app and subscription checker
- Uses `cron_restart: "0 9 * * *"` for daily execution

### 2. `ecosystem-subscription-checker.config.js` (New)
- Separate configuration for subscription checker only
- More granular control over the subscription checker process
- Enhanced logging and restart policies

### 3. `scripts/deploy-subscription-checker.sh` (New)
- Deployment script for the subscription checker
- Creates necessary directories and manages PM2 process
- Provides helpful commands for monitoring

## Deployment Options

### Option 1: Integrated Deployment (Recommended)
The subscription checker is included in your main ecosystem configuration and will be deployed automatically with your backend.

```bash
# Your existing GitHub Actions workflow will handle this
# The subscription checker will start/restart automatically
```

### Option 2: Separate Deployment
Deploy the subscription checker independently:

```bash
# SSH into your server
ssh root@your-server

# Navigate to app directory
cd /var/www/staffsync

# Run the deployment script
./scripts/deploy-subscription-checker.sh
```

## PM2 Commands

### Basic Commands
```bash
# View all running processes
pm2 status

# View subscription checker logs
pm2 logs staffsync-subscription-checker

# Restart subscription checker manually
pm2 restart staffsync-subscription-checker

# Stop subscription checker
pm2 stop staffsync-subscription-checker

# Start subscription checker
pm2 start ecosystem-subscription-checker.config.js --env production
```

### Log Management
```bash
# View real-time logs
tail -f /var/www/staffsync/logs/subscription-checker.log

# View error logs
tail -f /var/www/staffsync/logs/subscription-checker-error.log

# View output logs
tail -f /var/www/staffsync/logs/subscription-checker-out.log
```

### Monitoring
```bash
# Monitor PM2 processes
pm2 monit

# Check process details
pm2 show staffsync-subscription-checker

# View startup logs
pm2 logs --lines 100 staffsync-subscription-checker
```

## Cron Schedule Configuration

### Production Environment
Current schedule: `"0 9 * * *"` (Daily at 9 AM UTC)

### Development Environment  
Current schedule: `"0 */6 * * *"` (Every 6 hours for testing)

To change the schedule, modify the `cron_restart` value in the ecosystem config:

```javascript
// Examples:
cron_restart: "0 9 * * *"     // Daily at 9 AM UTC
cron_restart: "0 */6 * * *"   // Every 6 hours (dev)
cron_restart: "0 0 * * 0"     // Weekly on Sunday at midnight
cron_restart: "0 9 1 * *"      // Monthly on 1st at 9 AM
```

## Troubleshooting

### Common Issues

1. **Process not starting**
   ```bash
   # Check if tsx is installed
   npm list tsx
   
   # Install tsx if missing
   npm install -g tsx
   ```

2. **Permission issues**
   ```bash
   # Make sure deploy script is executable
   chmod +x scripts/deploy-subscription-checker.sh
   ```

3. **Logs not appearing**
   ```bash
   # Create logs directory
   mkdir -p /var/www/staffsync/logs
   
   # Check PM2 log configuration
   pm2 show staffsync-subscription-checker
   ```

4. **Process keeps restarting**
   ```bash
   # Check error logs for issues
   tail -f /var/www/staffsync/logs/subscription-checker-error.log
   
   # Manual test run
   npm run subscription:check
   ```

### Manual Testing
```bash
# Test the subscription checker manually
cd /var/www/staffsync
npm run subscription:check

# Test with PM2 (one-time run)
pm2 start scripts/check-subscription-expiry.ts --name test-subscription-check --interpreter npx --interpreter-args tsx
```

## Environment-Specific Deployment

### Production Deployment
Your GitHub Actions workflow has been updated to:
1. Create the logs directory automatically
2. Restart both PM2 processes on deployment
3. Save PM2 configuration for persistence

The subscription checker will be automatically deployed and configured when you push to your production branch.

### Development Deployment
Your dev GitHub Actions workflow has been updated with the same functionality:
1. Creates logs directory automatically
2. Restarts both PM2 processes on deployment
3. Saves PM2 configuration for persistence

**Development Differences:**
- **Schedule**: Every 6 hours (vs daily in production)
- **Memory Limit**: 512MB (vs 1GB in production)
- **Log Files**: Prefixed with "dev-" for easy identification

### Manual Development Deployment
```bash
# Deploy subscription checker for development
cd /var/www/staffsync
./scripts/deploy-dev-subscription-checker.sh

# Or use the standalone config
pm2 start ecosystem-dev-subscription-checker.config.js --env development
```

## Monitoring Recommendations

1. **Set up log rotation** to prevent logs from growing too large
2. **Monitor PM2 status** regularly
3. **Check subscription checker logs** periodically for errors
4. **Set up alerts** for failed subscription checks (optional)

## Security Notes

- The subscription checker runs with the same environment variables as your main app
- Ensure your `.env` file is properly secured
- Regular PM2 logs may contain sensitive information - secure the logs directory if needed
