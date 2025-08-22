require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
app.use(cors());
app.use(express.json()); // parse JSON request bodies
const morgan = require("morgan");
app.use(morgan("dev"));
const port = Number(process.env.PORT || 3000);
// NEW: Postgres client (pg)
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
if (!process.env.DATABASE_URL) {
  console.warn(
    "DATABASE_URL missing — /db and /notes will return 500 until set"
  );
}

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

// POST /notes — create a note from JSON body { "txt": "..." }
app.post("/notes", async (req, res, next) => {
  try {
    const body = req.body || {};
    const txt = typeof body.txt === "string" ? body.txt.trim() : "";
    if (!txt) {
      return res
        .status(400)
        .json({ error: 'Provide JSON like: { "txt": "Hello" }' });
    }

    const r = await pool.query(
      "INSERT INTO notes (txt) VALUES ($1) RETURNING *",
      [txt]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    next(e);
  }
});

// 404 for unknown routes (keep this BEFORE the error handler)
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Central error handler (last middleware)
app.use((err, req, res, next) => {
  console.error(err); // keep for debugging
  res
    .status(err.status || 500)
    .json({ error: err.message || "Internal Server Error" });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
