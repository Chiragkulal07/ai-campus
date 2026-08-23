const jwt = require("jsonwebtoken");
const redisClient = require("../config/redisClient");

const TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

local bucket = redis.call("HMGET", key, "tokens", "last_refill")
local tokens = tonumber(bucket[1])
local last_refill = tonumber(bucket[2])

if tokens == nil then
  tokens = capacity
  last_refill = now
end

local elapsed = math.max(0, now - last_refill)
tokens = math.min(capacity, tokens + (elapsed * refill_rate))

local allowed = 0
if tokens >= requested then
  tokens = tokens - requested
  allowed = 1
end

redis.call("HMSET", key, "tokens", tokens, "last_refill", now)
redis.call("EXPIRE", key, 3600)

return { allowed, tokens }
`;

// prefix keeps each limiter's Redis keys separate, so e.g. the strict "auth"
// limiter and the generous "general" limiter never share or steal tokens
function getClientKey(req, prefix) {
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return `ratelimit:${prefix}:user:${decoded.userId}`;
    } catch (err) {
      // invalid/expired token — fall through to IP
    }
  }
  return `ratelimit:${prefix}:ip:${req.ip}`;
}

// Factory — call this once per limiter you want (e.g. one strict for auth,
// one generous for everything else), each with its own capacity/refill.
function createRateLimiter({ capacity, refillPerMinute, prefix }) {
  const refillRate = refillPerMinute / 60; // tokens per second

  return async function rateLimiter(req, res, next) {
    const key = getClientKey(req, prefix);
    const now = Date.now() / 1000;

    try {
      const result = await redisClient.eval(
        TOKEN_BUCKET_SCRIPT,
        1,
        key,
        capacity,
        refillRate,
        now,
        1 // tokens requested per request
      );

      const [allowed, tokensLeft] = result;

      res.setHeader("X-RateLimit-Remaining", Math.floor(tokensLeft));

      if (allowed === 1) {
        next();
      } else {
        res.status(429).json({ error: "Too many requests. Please slow down." });
      }
    } catch (err) {
      console.error("Rate limiter error:", err);
      next(); // fail open — don't block traffic if Redis is down
    }
  };
}

module.exports = { createRateLimiter };