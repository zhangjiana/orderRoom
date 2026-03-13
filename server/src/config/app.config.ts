export default () => ({
  app: {
    env: process.env.NODE_ENV || "development",
    port: Number(process.env.PORT || 3001),
    bodyLimit: process.env.BODY_LIMIT || "1mb",
  },
  cors: {
    allowedOrigins: String(
      process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173",
    )
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    trustProxy: process.env.TRUST_PROXY || "loopback",
  },
  mysql: {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "doctor-training",
    database: process.env.MYSQL_DATABASE || "yanqing_binpeng",
    connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
  },
  seed: {
    adminUsername: process.env.ADMIN_SEED_USERNAME || "admin",
    adminPassword: process.env.ADMIN_SEED_PASSWORD || "Admin@123456",
  },
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    max: Number(process.env.RATE_LIMIT_MAX || 300),
  },
});
