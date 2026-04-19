module.exports = {
  apps: [
    {
      name: "staffsync-dev-subscription-checker",
      cwd: "/var/www/staffsync",
      script: "scripts/check-subscription-expiry.ts",
      exec_mode: "fork",
      instances: 1,
      interpreter: "npx",
      interpreter_args: "tsx",
      autorestart: false,
      watch: false,
      cron_restart: "0 */6 * * *", // Run every 6 hours in dev for testing
      env: {
        NODE_ENV: "development"
      },
      log_file: "/var/www/staffsync/logs/dev-subscription-checker.log",
      out_file: "/var/www/staffsync/logs/dev-subscription-checker-out.log",
      error_file: "/var/www/staffsync/logs/dev-subscription-checker-error.log",
      time: true,
      max_memory_restart: "512M",
      kill_timeout: 15000,
      restart_delay: 3000,
      max_restarts: 2,
      min_uptime: "5s"
    }
  ]
};
