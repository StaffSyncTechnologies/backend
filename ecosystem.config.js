module.exports = {
  apps: [
    {
      name: "staffsync-backend",
      cwd: "/var/www/staffsync",
      script: "src/index.ts",
      interpreter: "node",
      node_args: "--max-old-space-size=4096 -r ts-node/register/transpile-only -r dotenv/config",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "development",
        PORT: 3001
      }
    }
  ]
};