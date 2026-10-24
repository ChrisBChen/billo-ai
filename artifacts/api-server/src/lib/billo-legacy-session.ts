import { createHash } from "node:crypto";
import type { RequestHandler } from "express";
import { pool } from "@workspace/db";

declare global {
  namespace Express {
    interface Request { billoAccount?: { id: string } }
  }
}

/** Compatibility for existing browser sessions only; there are no login routes. */
export const loadLegacyAccount: RequestHandler = async (req, _res, next) => {
  const token = req.cookies?.billo_account;
  if (typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token)) {
    const hash = createHash("sha256").update(token).digest("hex");
    const result = await pool.query(
      "SELECT account_id AS id FROM billo_account_sessions WHERE token_hash=$1 AND expires_at>now()",
      [hash]);
    req.billoAccount = result.rows[0];
  }
  next();
};
