module.exports = {
  apps: [
    {
      name: "staffsync-backend",
      cwd: "/var/www/staffsync",
      script: "src/index.ts",
      exec_mode: "fork",
      instances: 1,
      interpreter: "node",
      node_args: "--max-old-space-size=4096 -r ts-node/register/transpile-only -r dotenv/config",
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "development",
        PORT: 3001
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3001
      }
    },
    {
      name: "staffsync-subscription-checker",
      cwd: "/var/www/staffsync",
      script: "scripts/check-subscription-expiry.ts",
      exec_mode: "fork",
      instances: 1,
      interpreter: "npx",
      interpreter_args: "tsx",
      autorestart: false,
      watch: false,
      cron_restart: "0 9 * * *", // Run daily at 9 AM UTC (production)
      env: {
        NODE_ENV: "production"
      },
      env_development: {
        NODE_ENV: "development",
        cron_restart: "0 */6 * * *" // Run every 6 hours in dev for testing
      },
      log_file: "/var/www/staffsync/logs/subscription-checker.log",
      out_file: "/var/www/staffsync/logs/subscription-checker-out.log",
      error_file: "/var/www/staffsync/logs/subscription-checker-error.log",
      time: true,
      max_memory_restart: "1G"
    }
  ]
};