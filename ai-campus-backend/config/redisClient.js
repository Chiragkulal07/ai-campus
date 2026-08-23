const Redis = require("ioredis");
require("dotenv").config()
console.log("Connecting to:", process.env.REDIS_URL);

const redisClient = new Redis(process.env.REDIS_URL);

redisClient.on("connect", () => console.log("Redis connected"));
redisClient.on("error", (err) => console.error("Redis error:", err));

module.exports = redisClient;