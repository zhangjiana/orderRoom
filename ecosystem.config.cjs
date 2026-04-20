const path = require("node:path");

const rootDir = __dirname;

module.exports = {
  apps: [
    {
      name: "yanqing-server",
      cwd: rootDir,
      script: path.join(rootDir, "server/dist/main.js"),
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        APP_ENV_FILE: path.join(rootDir, ".env.pm2"),
      },
    },
  ],
};
