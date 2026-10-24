import { randomBytes, createHash, randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { pool } from "@workspace/db";
import { BillError, type BillState } from "./billo-domain";

export const newId = () => randomBytes(18).toString("base64url");
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const cookieName = (id: string) => `billo_${id}`;
export const cookieOptions = {
  // Partitioned secure cookies also work inside an embedded app preview.
  // JSON-only mutations plus Origin/Sec-Fetch-Site checks enforce CSRF protection.
  httpOnly: true, secure: true, sameSite: "none" as const, partitioned: true,
  path: "/api/billo", maxAge: 30 * 86400 * 1000,
};
export async function findBill(id: string): Promise<BillState> {
  if (!/^[\w-]{24}$/.test(id)) throw new BillError(404, "Bill not found.");
  const result = await pool.query("SELECT state FROM billo_bills WHERE id=$1", [id]);
  if (!result.rowCount) throw new BillError(404, "Bill not found.");
  return result.rows[0].state;
}
export async function identify(req: Request, id: string): Promise<string | null> {
  const token = req.cookies?.[cookieName(id)];
  if (typeof token !== "string" || token.length > 100) return null;
  const result = await pool.query("SELECT participant_id FROM billo_sessions WHERE token_hash=$1 AND bill_id=$2 AND expires_at>now()", [hash(token), id]);
  return result.rows[0]?.participant_id ?? null;
}
export async function session(req: Request, id: string): Promise<string> {
  const me = await identify(req, id);
  if (!me) throw new BillError(401, "Join this bill to continue.");
  return me;
}
// Mutators run with a row lock, including joins. No in-memory state is authoritative.
export async function mutate(id: string, fn: (s: BillState) => void): Promise<BillState> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("SELECT state FROM billo_bills WHERE id=$1 FOR UPDATE", [id]);
    if (!result.rowCount) throw new BillError(404, "Bill not found.");
    const state: BillState = result.rows[0].state;
    fn(state);
    await client.query("UPDATE billo_bills SET state=$2::jsonb WHERE id=$1", [id, JSON.stringify(state)]);
    await client.query("COMMIT");
    return state;
  } catch (e) { await client.query("ROLLBACK"); throw e; }
  finally { client.release(); }
}
export async function addSession(id: string, participantId: string, res: Response) {
  const token = randomBytes(32).toString("base64url");
  await pool.query("INSERT INTO billo_sessions (token_hash,bill_id,participant_id,expires_at) VALUES ($1,$2,$3,$4)", [hash(token), id, participantId, new Date(Date.now() + cookieOptions.maxAge)]);
  res.cookie(cookieName(id), token, cookieOptions);
}
export const memberId = () => randomUUID();
