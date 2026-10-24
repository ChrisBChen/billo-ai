import { pgTable, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// A bill is a single transactional aggregate. Locking its row serializes joins,
// allocation edits and finalization without losing concurrent participants.
export const billsTable = pgTable("billo_bills", {
  id: text("id").primaryKey(),
  state: jsonb("state").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const billSessionsTable = pgTable("billo_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  billId: text("bill_id").notNull().references(() => billsTable.id, { onDelete: "cascade" }),
  participantId: text("participant_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, table => [index("billo_session_bill_idx").on(table.billId)]);
export const insertBillSchema = createInsertSchema(billsTable);
export type BillRecord = typeof billsTable.$inferSelect;
