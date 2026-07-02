import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const redisUrl = process.env.REDIS_URL;

export const redis = redisUrl 
  ? new Redis(redisUrl) 
  : new Redis({
      host: process.env.REDISHOST || "localhost",
      port: Number(process.env.REDISPORT || 6379),
      password: process.env.REDISPASSWORD || undefined,
    });

redis.on("connect", () => {
  console.info("Connected to Redis server.");
});

redis.on("error", (err) => {
  console.error("Redis connection error:", err.message);
});
