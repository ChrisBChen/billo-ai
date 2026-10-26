import { randomBytes, createHash, randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { pool } from "@workspace/db";
import { BillError, upgradeSelections, type BillState } from "./billo-domain";

export const newId = () => randomBytes(18).toString("base64url");
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const cookieName = (id: string) => `billo_${id}`;
export const cookieOptions = {
  // The app and API share one origin on Vercel, so a first-party Lax cookie suffices.
  // JSON-only mutations plus Origin/Sec-Fetch-Site checks add CSRF protection.
  httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const,
  path: "/api/billo", maxAge: 30 * 86400 * 1000,
};
export async function findBill(id: string): Promise<BillState> {
  if (!/^[\w-]{24}$/.test(id)) throw new BillError(404, "Bill not found.");
  const result = await pool.query("SELECT state FROM billo_bills WHERE id=$1", [id]);
  if (!result.rowCount) throw new BillError(404, "Bill not found.");
  const state: BillState = result.rows[0].state;
  return !state.shareCode || (state.status === "open" && state.selectionVersion !== 1) ? mutate(id, () => {}) : state;
}
export async function resolveShareCode(code: string): Promise<BillState> {
  if (!/^[A-Za-z0-9_-]{12}$/.test(code)) throw new BillError(404, "This bill link does not exist.");
  const result = await pool.query("SELECT id FROM billo_bills WHERE state->>'shareCode'=$1", [code]);
  if (result.rowCount !== 1) throw new BillError(404, "This bill link does not exist.");
  return findBill(result.rows[0].id);
}
export async function identify(req: Request, id: string): Promise<string | null> {
  const token = req.cookies?.[cookieName(id)];
  if (typeof token === "string" && token.length <= 100) {
    const result = await pool.query("SELECT participant_id FROM billo_sessions WHERE token_hash=$1 AND bill_id=$2 AND expires_at>now()", [hash(token), id]);
    const me: string | undefined = result.rows[0]?.participant_id;
    if (me && (await findBill(id)).participants.some(p => p.id === me)) return me;
  }
  // Preserve seats opened on another browser during the login experiment.
  // A genuine old account session is proof; matching a display name is not.
  if (req.billoAccount) {
    const state = await findBill(id);
    const linked = state.participants.find(p => p.userId === req.billoAccount!.id);
    if (linked) {
      if (req.res) await addSession(id, linked.id, req.res);
      return linked.id;
    }
  }
  return null;
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
    upgradeSelections(state);
    if (!state.shareCode) {
      // 72 random bits; serialize collision checks across processes without
      // changing existing bill IDs, session cookies, or database table schemas.
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = randomBytes(9).toString("base64url");
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`billo-share:${code}`]);
        const existing = await client.query("SELECT 1 FROM billo_bills WHERE state->>'shareCode'=$1 LIMIT 1", [code]);
        if (!existing.rowCount) { state.shareCode = code; break; }
      }
      if (!state.shareCode) throw new BillError(503, "Could not create an invite link. Please try again.");
    }
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
