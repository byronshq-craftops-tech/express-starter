require("dotenv").config();
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

// NEW: Redis client
const Redis = require("ioredis");
const redis = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT || 6379),
});

app.get("/", (req, res) => {
  res.send("Hello Byron 🚀 — your MacBook is now a dev machine!");
});

// NEW: simple cache demo
app.get("/cache", async (req, res) => {
  try {
    const key = "greeting";
    let value = await redis.get(key);

    if (!value) {
      value = `Hi Byron, time is ${new Date().toISOString()}`;
      // expire in 30s so you can see it change later
      await redis.set(key, value, "EX", 30);
    }

    res.json({ key, value, note: "Cached for up to 30 seconds" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
