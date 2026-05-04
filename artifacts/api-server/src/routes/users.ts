import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, count } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router: IRouter = Router();

function safeUser(user: typeof usersTable.$inferSelect) {
  return {
    user_id: user.id,
    id: user.id,
    full_name: user.fullName,
    name: user.fullName,
    email: user.email ?? null,
    phone: user.phone ?? null,
    ward_id: user.wardId ?? null,
    avatar_url: user.avatarUrl ?? null,
    role: user.role,
    is_active: user.isActive,
    createdAt: user.createdAt,
  };
}

router.get("/users", requireAuth, requireRole("admin"), async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"))));
  const offset = (page - 1) * limit;

  let query = db.select().from(usersTable);
  let countQuery = db.select({ total: count() }).from(usersTable);

  if (req.query.role) {
    const roleFilter = eq(usersTable.role, req.query.role as any);
    query = query.where(roleFilter) as typeof query;
    countQuery = countQuery.where(roleFilter) as typeof countQuery;
  }

  const [{ total }] = await countQuery;
  const data = await query.limit(limit).offset(offset);

  res.json({
    success: true,
    data: { data: data.map(safeUser), total, page, total_pages: Math.ceil(total / limit) },
    message: "OK",
  });
});

router.get("/users/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ success: false, message: "Invalid ID" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) {
    res.status(404).json({ success: false, message: "User not found" });
    return;
  }
  res.json({ success: true, data: safeUser(user), message: "OK" });
});

router.get("/workers", requireAuth, requireRole("admin"), async (_req, res) => {
  const workers = await db.select().from(usersTable).where(eq(usersTable.role, "worker"));
  res.json({ success: true, data: workers.map(safeUser), message: "OK" });
});

export default router;
