import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { alertsTable } from "@workspace/db/schema";
import { eq, or, isNull, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { z } from "zod";

const router: IRouter = Router();

router.get("/alerts", requireAuth, async (req, res) => {
  const alerts = await db
    .select()
    .from(alertsTable)
    .where(or(isNull(alertsTable.userId), eq(alertsTable.userId, req.user!.userId)))
    .orderBy(desc(alertsTable.createdAt))
    .limit(50);

  res.json({ success: true, data: alerts, message: "OK" });
});

router.post("/alerts", requireAuth, requireRole("admin"), async (req, res) => {
  const schema = z.object({
    title: z.string().min(1),
    message: z.string().min(1),
    type: z.enum(["info", "warning", "urgent"]).default("info"),
    user_id: z.number().int().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: parsed.error.message });
    return;
  }

  const [alert] = await db.insert(alertsTable).values({
    title: parsed.data.title,
    message: parsed.data.message,
    type: parsed.data.type,
    userId: parsed.data.user_id ?? null,
  }).returning();

  res.status(201).json({ success: true, data: alert, message: "Alert created" });
});

router.put("/alerts/:id/read", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ success: false, message: "Invalid ID" });
    return;
  }
  await db.update(alertsTable).set({ isRead: true }).where(eq(alertsTable.id, id));
  res.json({ success: true, data: null, message: "Marked as read" });
});

export default router;
