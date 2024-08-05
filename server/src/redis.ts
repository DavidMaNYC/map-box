import Redis from "ioredis";

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  password: process.env.REDIS_PASSWORD || undefined,
  tls: {
    rejectUnauthorized: false, // Set to false to accept self-signed certificates (optional, depends on your security requirements)
  },
});

redis.on("error", (err) => {
  console.error("Redis error:", err);
});

export default redis;
