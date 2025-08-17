require("dotenv").config();
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
// NEW: Postgres client (pg)
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// NEW: Redis client
const Redis = require("ioredis");
const redis = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT || 6379),
});

// NEW: ensure table exists on start
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      txt TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log("DB ready");
}
initDb().catch((err) => {
  console.error("DB init error:", err);
  process.exit(1);
});

// NEW: quick DB health check
app.get("/db", async (req, res) => {
  try {
    const r = await pool.query("SELECT NOW() AS now");
    res.json({ ok: true, now: r.rows[0].now });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// NEW: add a note via query param (easy to test in browser)
app.get("/add-note", async (req, res) => {
  try {
    const txt = (req.query.txt || "").toString().trim();
    if (!txt) return res.status(400).json({ error: "use ?txt=hello" });
    const r = await pool.query(
      "INSERT INTO notes (txt) VALUES ($1) RETURNING *",
      [txt]
    );
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// NEW: list notes
app.get("/notes", async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM notes ORDER BY id DESC LIMIT 50");
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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
