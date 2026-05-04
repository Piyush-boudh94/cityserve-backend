import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { complaintsTable, usersTable, categoriesTable } from "@workspace/db/schema";
import { eq, count, desc, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/dashboard/stats", requireAuth, requireRole("admin", "worker"), async (_req, res) => {
  const [{ total: totalComplaints }] = await db.select({ total: count() }).from(complaintsTable);
  const [{ total: pendingComplaints }] = await db.select({ total: count() }).from(complaintsTable).where(eq(complaintsTable.status, "pending"));
  const [{ total: assignedComplaints }] = await db.select({ total: count() }).from(complaintsTable).where(eq(complaintsTable.status, "assigned"));
  const [{ total: inProgressComplaints }] = await db.select({ total: count() }).from(complaintsTable).where(eq(complaintsTable.status, "in_progress"));
  const [{ total: resolvedComplaints }] = await db.select({ total: count() }).from(complaintsTable).where(eq(complaintsTable.status, "resolved"));
  const [{ total: closedComplaints }] = await db.select({ total: count() }).from(complaintsTable).where(eq(complaintsTable.status, "closed"));
  const [{ total: totalUsers }] = await db.select({ total: count() }).from(usersTable).where(eq(usersTable.role, "citizen"));
  const [{ total: totalWorkers }] = await db.select({ total: count() }).from(usersTable).where(eq(usersTable.role, "worker"));

  const categories = await db.select().from(categoriesTable);
  const byCategory = await Promise.all(
    categories.map(async (cat) => {
      const [{ total: catCount }] = await db.select({ total: count() }).from(complaintsTable).where(eq(complaintsTable.categoryId, cat.id));
      return { category_id: cat.id, categoryId: cat.id, category_name: cat.name, categoryName: cat.name, count: catCount };
    })
  );

  res.json({
    success: true,
    data: {
      total_complaints: totalComplaints,
      totalComplaints,
      pending_complaints: pendingComplaints,
      pendingComplaints,
      in_progress_complaints: inProgressComplaints + assignedComplaints,
      inProgressComplaints: inProgressComplaints + assignedComplaints,
      resolved_complaints: resolvedComplaints,
      resolvedComplaints,
      closed_complaints: closedComplaints,
      closedComplaints,
      total_users: totalUsers,
      totalUsers,
      total_workers: totalWorkers,
      totalWorkers,
      by_category: byCategory,
      byCategory,
    },
    message: "OK",
  });
});

router.get("/dashboard/recent", requireAuth, requireRole("admin", "worker"), async (_req, res) => {
  const recent = await db
    .select()
    .from(complaintsTable)
    .orderBy(desc(complaintsTable.updatedAt))
    .limit(20);

  res.json({
    success: true,
    data: recent.map((c) => ({
      complaint_id: c.id,
      id: c.id,
      title: c.title,
      status: c.status,
      priority: c.priority,
      address: c.address ?? null,
      updated_at: c.updatedAt,
    })),
    message: "OK",
  });
});

router.get("/dashboard/urgent", requireAuth, requireRole("admin", "worker"), async (_req, res) => {
  const urgent = await db
    .select()
    .from(complaintsTable)
    .where(and(eq(complaintsTable.priority, "high"), eq(complaintsTable.status, "pending")))
    .orderBy(desc(complaintsTable.createdAt))
    .limit(20);

  res.json({
    success: true,
    data: urgent.map((c) => ({
      complaint_id: c.id,
      id: c.id,
      title: c.title,
      status: c.status,
      priority: c.priority,
      address: c.address ?? null,
      created_at: c.createdAt,
    })),
    message: "OK",
  });
});

export default router;
