/**
 * Auth Service
 * - Registers users, logs them in/out, and manages sessions in Redis.
 * - Stores users in PostgreSQL.
 * - Issues an HttpOnly cookie "sid" that other services (Task) validate via Redis.
 *
 * Intentionally minimal: pure SQL with 'pg' for clarity.
 */
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import Redis from "ioredis";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cookieParser());

// Allow frontend origin; cookie needs credentials
const ORIGIN = process.env.ORIGIN || "http://localhost";
app.use(
  cors({
    origin: ORIGIN,
    credentials: true,
  })
);

// --- Postgres ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create users table if not exists
const initSql = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

pool.query(initSql).catch((e) => {
  console.error("Failed to init DB", e);
  process.exit(1);
});

// --- Redis ---
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379/0");
const SESSION_TTL = parseInt(process.env.SESSION_TTL_SECONDS || "2592000", 10); // 30d
const COOKIE_SECURE = (process.env.COOKIE_SECURE || "false") === "true";

function setSessionCookie(res, sid) {
  res.cookie("sid", sid, {
    httpOnly: true,
    sameSite: "lax",
    secure: COOKIE_SECURE, // set true when behind HTTPS
    maxAge: SESSION_TTL * 1000,
    path: "/",
  });
}

async function createSession(userId) {
  const sid = uuidv4();
  await redis.set(`sid:${sid}`, String(userId), "EX", SESSION_TTL);
  return sid;
}

async function destroySession(sid) {
  await redis.del(`sid:${sid}`);
}

// --- Routes ---

/**
 * POST /api/auth/register
 * body: { email, name, password }
 */
app.post("/api/auth/register", async (req, res) => {
  const { email, name, password } = req.body || {};
  if (!email || !name || !password) {
    return res.status(400).json({ error: "email, name, and password are required" });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      "INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, name, created_at",
      [email.toLowerCase(), name, hash]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === "23505") {
      return res.status(409).json({ error: "Email already registered" });
    }
    console.error(e);
    res.status(500).json({ error: "Internal error" });
  }
});

/**
 * POST /api/auth/login
 * body: { email, password }
 * On success: sets cookie 'sid'
 */
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }
  try {
    const { rows } = await pool.query("SELECT id, email, name, password_hash FROM users WHERE email=$1", [
      email.toLowerCase(),
    ]);
    if (!rows.length) return res.status(401).json({ error: "Invalid credentials" });
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const sid = await createSession(user.id);
    setSessionCookie(res, sid);
    res.json({ id: user.id, email: user.email, name: user.name });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal error" });
  }
});

/**
 * POST /api/auth/logout
 * Clears session + cookie
 */
app.post("/api/auth/logout", async (req, res) => {
  const sid = req.cookies?.sid;
  if (sid) await destroySession(sid);
  res.clearCookie("sid", { path: "/" });
  res.json({ ok: true });
});

/**
 * GET /api/auth/me
 * Returns current user if session is valid.
 */
app.get("/api/auth/me", async (req, res) => {
  const sid = req.cookies?.sid;
  if (!sid) return res.status(401).json({ error: "Not authenticated" });
  const userId = await redis.get(`sid:${sid}`);
  if (!userId) return res.status(401).json({ error: "Session expired" });
  const { rows } = await pool.query("SELECT id, email, name FROM users WHERE id=$1", [userId]);
  if (!rows.length) return res.status(401).json({ error: "User not found" });
  res.json(rows[0]);
});

app.get("/healthz", (_req, res) => res.json({ ok: true }));

const port = parseInt(process.env.PORT || "4000", 10);
app.listen(port, () => {
  console.log(`Auth service on http://0.0.0.0:${port}`);
});
