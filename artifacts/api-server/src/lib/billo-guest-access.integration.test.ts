import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { GetBillResponse } from "@workspace/api-zod";

test("name-only access preserves bill cookies, host permissions and legacy sessions", {
  skip: process.env.RUN_DEV_GUEST_TESTS !== "1",
}, async () => {
  assert.ok(process.env.BILLO_TEST_HOST, "set BILLO_TEST_HOST to the deployed host, e.g. billo.vercel.app");
  const base = `https://${process.env.BILLO_TEST_HOST}`, stamp = randomUUID();
  const payer = new Map<string, string>(), friend = new Map<string, string>();
  let billId: string | undefined, accountId: string | undefined;
  async function request(path: string, cookies: Map<string, string>, method = "GET", body?: unknown, extra: Record<string, string> = {}) {
    const response = await fetch(`${base}/api/billo${path}`, {
      method, headers: {
        Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
        ...(method === "GET" ? {} : { "Content-Type": "application/json", Origin: base }), ...extra,
      }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    for (const raw of response.headers.getSetCookie()) {
      const part = raw.split(";")[0]!, i = part.indexOf("=");
      cookies.set(part.slice(0, i), part.slice(i + 1));
    }
    return response;
  }
  try {
    const created = await request("/bills", payer, "POST", { name: "Guest Payer", title: `TEST Guest ${stamp}`, venmo: "testpayer" });
    assert.equal(created.status, 201);
    const bill = GetBillResponse.parse(await created.json());
    billId = bill.id;
    assert.equal(payer.has(`billo_${billId}`), true);
    assert.equal((await request(`/bills/${billId}`, friend)).status, 401);
    const receipt = {
      title: bill.title,
      items: [{ id: "burger", name: "Burger", cents: 1000, mode: "equal", units: 1, allocations: [] }],
      taxCents: 100, tipMode: "amount", tipValue: 200, adjustmentCents: 0, totalCents: 1300, warnings: [],
    };
    assert.equal((await request(`/bills/${billId}`, payer, "PATCH", { action: "receipt", revision: bill.revision, receipt })).status, 200);
    assert.equal((await request(`/bills/${billId}/invite`, friend)).status, 200);
    const joined = await request(`/bills/${billId}/join`, friend, "POST", { name: "Guest Friend" });
    assert.equal(joined.status, 200);
    const guest = GetBillResponse.parse(await joined.json());
    assert.notEqual(guest.meId, bill.payerId);
    assert.equal((await request(`/bills/${billId}`, friend, "PATCH", { action: "receipt", revision: guest.revision, receipt })).status, 403);
    assert.equal((await request(`/bills/${billId}`, payer, "PATCH", {}, { Origin: "https://evil.example" })).status, 403);

    // A pre-existing account-linked seat must still accept its own bill cookie.
    accountId = `legacy-${stamp}`;
    await pool.query("INSERT INTO billo_accounts (id,email,name,password_hash) VALUES ($1,$2,$3,$4)",
      [accountId, `legacy-${stamp}@example.com`, "Legacy fixture", "retired-no-login"]);
    await pool.query("UPDATE billo_bills SET state=jsonb_set(state,$2,to_jsonb($3::text)) WHERE id=$1",
      [billId, "{participants,0,userId}", accountId]);
    assert.equal(GetBillResponse.parse(await (await request(`/bills/${billId}`, payer)).json()).meId, bill.payerId);

    // A real old account session is converted to a per-bill cookie, with no
    // signup, password, login form, or loss of the original payer's identity.
    const token = randomBytes(32).toString("base64url");
    await pool.query("INSERT INTO billo_account_sessions (token_hash,account_id,expires_at) VALUES ($1,$2,$3)",
      [createHash("sha256").update(token).digest("hex"), accountId, new Date(Date.now() + 300000)]);
    const legacy = new Map([["billo_account", token]]);
    const restored = await request(`/bills/${billId}`, legacy);
    assert.equal(restored.status, 200);
    assert.equal(GetBillResponse.parse(await restored.json()).meId, bill.payerId);
    assert.equal(legacy.has(`billo_${billId}`), true);
    legacy.delete("billo_account");
    assert.equal((await request(`/bills/${billId}`, legacy)).status, 200);

    const forged = new Map([[`billo_${billId}`, randomBytes(32).toString("base64url")]]);
    assert.equal((await request(`/bills/${billId}`, forged)).status, 401);
    assert.equal((await request("/auth/login", friend, "POST", {})).status, 404);
    assert.equal((await request("/auth/signup", friend, "POST", {})).status, 404);
  } finally {
    if (billId) await pool.query("DELETE FROM billo_bills WHERE id=$1", [billId]);
    if (accountId) await pool.query("DELETE FROM billo_accounts WHERE id=$1", [accountId]);
    await pool.end();
  }
});
