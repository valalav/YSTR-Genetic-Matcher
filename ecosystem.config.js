module.exports = {
  apps: [
    {
      name: "ftdna-haplo-app",
      cwd: "./ftdna_haplo",
      script: "./server/server.js",
      env_production: {
        NODE_ENV: "production",
        PORT: 9003,
        API_PATH: "/api",
        // В продакшене укажите здесь дополнительные домены если нужно, например "https://your-domain.com"
        // Порт 9002 разрешен автоматически логикой CORS
        ALLOWED_ORIGINS: ""
      }
    },
    {
      name: "str-matcher-app",
      cwd: "./str-matcher",
      // Прямой вызов бинарного файла Next.js - это надежный кроссплатформенный способ
      script: "./node_modules/next/dist/bin/next",
      args: "start -p 9002",
      env_production: {
        NODE_ENV: "production",
        // Указываем, где находится API для проксирования
        HAPLO_API_URL: "http://localhost:9003"
      }
    },
    {
      name: "backend-api-server",
      cwd: "./backend",
      script: "./server.js",
      instances: 8,  // 8 Node.js processes (25% of 32 cores)
      exec_mode: "cluster",  // Enable cluster mode for load balancing
      env_production: {
        NODE_ENV: "production",
        PORT: 9004,
        DB_MAX_CONNECTIONS: 12  // Total pool size for all instances
      },
      max_memory_restart: "512M",  // Restart if process exceeds 512MB
      autorestart: true,
      watch: false,
      min_uptime: "10s",
      max_restarts: 10
    }
  ]
};
