import { spawn, spawnSync } from "node:child_process";
import process from "node:process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const nodeCommand = process.execPath;

function runInitialBuild() {
  const result = spawnSync(npmCommand, ["run", "build:server"], {
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

runInitialBuild();

const buildWatcher = spawn(
  npmCommand,
  ["run", "build:server", "--", "--watch", "--preserveWatchOutput"],
  {
    stdio: "inherit",
    env: process.env,
  },
);

const runtime = spawn(nodeCommand, ["--watch", "./server/dist/main.js"], {
  stdio: "inherit",
  env: process.env,
});

function shutdown(signal) {
  buildWatcher.kill(signal);
  runtime.kill(signal);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

buildWatcher.on("exit", (code) => {
  if (code && code !== 0) {
    runtime.kill("SIGTERM");
    process.exit(code);
  }
});

runtime.on("exit", (code) => {
  buildWatcher.kill("SIGTERM");
  process.exit(code ?? 0);
});
