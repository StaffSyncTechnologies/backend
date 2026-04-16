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
      name: "staffsync-prod",
      cwd: "/var/www/staffsync-prod",
      script: "src/index.ts",
      exec_mode: "fork",
      instances: 1,
      interpreter: "node",
      node_args: "--max-old-space-size=4096 -r ts-node/register/transpile-only -r dotenv/config",
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: 3001
      }
    }
  ]
};