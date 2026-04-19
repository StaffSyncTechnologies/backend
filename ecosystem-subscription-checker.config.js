module.exports = {
  apps: [
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
      cron_restart: "0 9 * * *", // Run daily at 9 AM UTC
      env: {
        NODE_ENV: "production"
      },
      log_file: "/var/www/staffsync/logs/subscription-checker.log",
      out_file: "/var/www/staffsync/logs/subscription-checker-out.log",
      error_file: "/var/www/staffsync/logs/subscription-checker-error.log",
      time: true,
      max_memory_restart: "1G",
      kill_timeout: 30000,
      restart_delay: 5000,
      max_restarts: 3,
      min_uptime: "10s"
    }
  ]
};
