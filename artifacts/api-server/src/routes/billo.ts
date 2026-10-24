import { Router, type IRouter, type ErrorRequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { pool } from "@workspace/db";
import { CreateBillBody, JoinBillBody, ChangeBillBody, ScanReceiptBody, GetBillResponse } from "@workspace/api-zod";
import { BillError, type BillState, view, change, requireThat, invalidate } from "../lib/billo-domain";
import { newId, memberId, findBill, identify, session, addSession, mutate } from "../lib/billo-store";
import { extractReceipt } from "../lib/billo-ocr";

const router: IRouter = Router();
router.use("/billo", (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
router.use("/billo", (req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    if (!req.is("application/json") || req.get("sec-fetch-site") === "cross-site") {
      res.status(403).json({ error: "Use Billo to make this request." }); return;
    }
    const origin = req.get("origin");
    if (origin) {
      try {
        const requestHost = req.get("x-forwarded-host")?.split(",")[0]?.trim() || req.get("host");
        if (new URL(origin).host !== requestHost) {
          res.status(403).json({ error: "Cross-origin changes are not allowed." }); return;
        }
      } catch { res.status(403).json({ error: "Invalid origin." }); return; }
    }
  }
  next();
});
const createLimiter = rateLimit({ windowMs: 3600000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Too many new bills. Try again later." } });
const joinLimiter = rateLimit({ windowMs: 60000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Too many join attempts. Try again shortly." } });
const writeLimiter = rateLimit({ windowMs: 60000, limit: 180, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Too many changes. Wait a moment." } });
const idOf = (value: string | string[]) => Array.isArray(value) ? value[0]! : value;
const send = (res: import("express").Response, s: BillState, me: string, status = 200) => res.status(status).json(GetBillResponse.parse(view(s, me)));

router.post("/billo/bills", createLimiter, async (req, res): Promise<void> => {
  const parsed = CreateBillBody.safeParse(req.body);
  requireThat(parsed.success, "Enter your name, bill name and payment details.");
  const input = parsed.data;
  const name = input.name.trim(), title = input.title.trim();
  const venmo = (input.venmo ?? "").trim().replace(/^@/, "");
  const zelle = (input.zelle ?? "").trim();
  requireThat(name && title, "Your name and bill name are required.");
  requireThat(venmo || zelle, "Add a Venmo username or Zelle email/US phone number.");
  requireThat(!venmo || /^[A-Za-z0-9_-]{5,30}$/.test(venmo), "Enter a valid Venmo username (5–30 letters, numbers, hyphens or underscores).");
  requireThat(!zelle || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(zelle) || /^(?:1)?\d{10}$/.test(zelle.replace(/[+()\s.-]/g, "")), "Enter a valid Zelle email or US phone number.");
  const id = newId(), me = memberId();
  const state: BillState = {
    id, title, payerId: me, status: "open", revision: 0, splitMode: "itemized", venmo, zelle, scans: [],
    receipt: { title, items: [], taxCents: 0, tipMode: "percent", tipValue: 2000, totalCents: 0, adjustmentCents: 0, warnings: [] },
    participants: [{ id: me, name, finished: false, paid: false }],
  };
  await pool.query("INSERT INTO billo_bills (id,state) VALUES ($1,$2::jsonb)", [id, JSON.stringify(state)]);
  await addSession(id, me, res);
  send(res, state, me, 201);
});
router.get("/billo/bills/:id/invite", async (req, res): Promise<void> => {
  const state = await findBill(idOf(req.params.id!));
  res.json({ title: state.title, status: state.status });
});
router.get("/billo/bills/:id", async (req, res): Promise<void> => {
  const id = idOf(req.params.id!);
  const me = await session(req, id);
  const state = await findBill(id);
  send(res, state, me);
});
router.post("/billo/bills/:id/join", joinLimiter, async (req, res): Promise<void> => {
  const parsed = JoinBillBody.safeParse(req.body);
  requireThat(parsed.success && parsed.data.name.trim(), "Enter your name.");
  const id = idOf(req.params.id!);
  const existing = await identify(req, id);
  if (existing) { send(res, await findBill(id), existing); return; }
  const me = memberId();
  const state = await mutate(id, s => {
    requireThat(s.status === "open", "This bill is closed.", 409);
    requireThat(s.participants.length < 30, "This bill has reached its 30-person limit.");
    requireThat(!s.participants.some(p => p.name.toLowerCase() === parsed.data.name.trim().toLowerCase()), "That name is taken. Add an initial to distinguish yourself.");
    s.participants.push({ id: me, name: parsed.data.name.trim(), finished: false, paid: false });
    invalidate(s); s.revision++;
  });
  await addSession(id, me, res);
  send(res, state, me);
});
router.patch("/billo/bills/:id", writeLimiter, async (req, res): Promise<void> => {
  const parsed = ChangeBillBody.safeParse(req.body);
  requireThat(parsed.success, "Invalid bill change. Check the values and try again.");
  const id = idOf(req.params.id!), me = await session(req, id);
  const state = await mutate(id, s => change(s, me, parsed.data));
  send(res, state, me);
});
router.post("/billo/bills/:id/scan", async (req, res): Promise<void> => {
  const id = idOf(req.params.id!), me = await session(req, id);
  const parsed = ScanReceiptBody.safeParse(req.body);
  requireThat(parsed.success, "Use a receipt image under 8 MB.");
  await mutate(id, s => {
    requireThat(s.payerId === me, "Only the payer can scan receipts.", 403);
    requireThat(s.status === "open", "This bill is closed.", 409);
    s.scans = s.scans.filter(t => Date.now() - t < 3600000);
    requireThat(s.scans.length < 5, "Scanning is limited to five attempts per bill per hour. You can still enter the receipt manually.", 429);
    s.scans.push(Date.now());
  });
  res.json(await extractReceipt(parsed.data.dataUrl));
});
export const billoErrors: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof BillError) { res.status(err.status).json({ error: err.message }); return; }
  if (err.type === "entity.too.large") { res.status(413).json({ error: "Use an image under 8 MB." }); return; }
  if (err instanceof SyntaxError) { res.status(400).json({ error: "Invalid request data." }); return; }
  req.log.error({ errorType: err?.name ?? "UnknownError" }, "Request failed");
  res.status(500).json({ error: "Something went wrong. Please try again." });
};
export default router;
