import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  complaintsTable,
  complaintUpdatesTable,
  usersTable,
  categoriesTable,
  upvotesTable,
  savesTable,
  commentsTable,
} from "@workspace/db/schema";
import { eq, and, desc, gte, lte, count, inArray, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { notify, notifyMany } from "../lib/fcm.js";
import { z } from "zod";

const router: IRouter = Router();

function safeUser(user: typeof usersTable.$inferSelect | undefined) {
  if (!user) return null;
  return {
    user_id: user.id,
    id: user.id,
    full_name: user.fullName,
    name: user.fullName,
    phone: user.phone ?? null,
    role: user.role,
    avatar_url: user.avatarUrl ?? null,
  };
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "Pending Review",
    assigned: "Assigned to Worker",
    in_progress: "In Progress",
    resolved: "Resolved",
    closed: "Closed",
  };
  return labels[status] ?? status;
}

async function getAdminTokens(): Promise<Array<string | null | undefined>> {
  const admins = await db
    .select({ fcmToken: usersTable.fcmToken })
    .from(usersTable)
    .where(eq(usersTable.role, "admin"));
  return admins.map((a) => a.fcmToken);
}

function formatComplaint(c: typeof complaintsTable.$inferSelect) {
  return {
    complaint_id: c.id,
    id: c.id,
    title: c.title,
    description: c.description,
    status: c.status,
    priority: c.priority,
    latitude: c.latitude ?? null,
    longitude: c.longitude ?? null,
    address: c.address ?? null,
    image_url: c.imageUrl ?? null,
    imageUrl: c.imageUrl ?? null,
    resolution_image_url: c.resolutionImageUrl ?? null,
    resolutionImageUrl: c.resolutionImageUrl ?? null,
    progress_percent: c.progressPercent ?? 0,
    progressPercent: c.progressPercent ?? 0,
    ward_id: c.wardId ?? null,
    upvote_count: c.upvoteCount,
    user_id: c.userId,
    category_id: c.categoryId,
    assigned_to: c.assignedTo ?? null,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

// GET /api/complaints
router.get("/complaints", requireAuth, async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"))));
  const offset = (page - 1) * limit;

  const conditions = [];
  if (req.query.status) conditions.push(eq(complaintsTable.status, req.query.status as any));
  if (req.query.category_id) conditions.push(eq(complaintsTable.categoryId, parseInt(String(req.query.category_id))));
  if (req.query.user_id) conditions.push(eq(complaintsTable.userId, parseInt(String(req.query.user_id))));
  if (req.query.ward_id) conditions.push(eq(complaintsTable.wardId, parseInt(String(req.query.ward_id))));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(complaintsTable).where(whereClause);
  const data = await db.select().from(complaintsTable).where(whereClause).orderBy(desc(complaintsTable.createdAt)).limit(limit).offset(offset);

  res.json({
    success: true,
    data: {
      data: data.map(formatComplaint),
      total,
      page,
      total_pages: Math.ceil(total / limit),
      limit,
    },
    message: "OK",
  });
});

// GET /api/complaints/my
router.get("/complaints/my", requireAuth, async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"))));
  const offset = (page - 1) * limit;

  const [{ total }] = await db.select({ total: count() }).from(complaintsTable).where(eq(complaintsTable.userId, req.user!.userId));
  const data = await db.select().from(complaintsTable).where(eq(complaintsTable.userId, req.user!.userId)).orderBy(desc(complaintsTable.createdAt)).limit(limit).offset(offset);

  res.json({
    success: true,
    data: { data: data.map(formatComplaint), total, page, total_pages: Math.ceil(total / limit) },
    message: "OK",
  });
});

// GET /api/complaints/saved
router.get("/complaints/saved", requireAuth, async (req, res) => {
  const savedRows = await db
    .select({ complaintId: savesTable.complaintId })
    .from(savesTable)
    .where(eq(savesTable.userId, req.user!.userId));

  const ids = savedRows.map((r) => r.complaintId);
  if (ids.length === 0) {
    res.json({ success: true, data: { data: [], total: 0, page: 1, total_pages: 0 }, message: "OK" });
    return;
  }

  const data = await db.select().from(complaintsTable).where(inArray(complaintsTable.id, ids)).orderBy(desc(complaintsTable.createdAt));
  res.json({
    success: true,
    data: { data: data.map(formatComplaint), total: data.length, page: 1, total_pages: 1 },
    message: "OK",
  });
});

// POST /api/complaints
router.post("/complaints", requireAuth, async (req, res) => {
  const schema = z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    category_id: z.number().int().positive().optional(),
    categoryId: z.number().int().positive().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    address: z.string().optional(),
    image_url: z.string().optional(),
    imageUrl: z.string().optional(),
    image_urls: z.array(z.string()).optional(),
    ward_id: z.number().int().optional(),
    priority: z.enum(["low", "medium", "high"]).default("medium"),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: parsed.error.message });
    return;
  }

  const categoryId = parsed.data.category_id ?? parsed.data.categoryId;
  if (!categoryId) {
    res.status(400).json({ success: false, message: "category_id is required" });
    return;
  }

  const imageUrl = parsed.data.image_url ?? parsed.data.imageUrl ?? (parsed.data.image_urls?.[0]);

  const [complaint] = await db.insert(complaintsTable).values({
    title: parsed.data.title,
    description: parsed.data.description,
    categoryId,
    latitude: parsed.data.latitude,
    longitude: parsed.data.longitude,
    address: parsed.data.address,
    imageUrl: imageUrl ?? null,
    wardId: parsed.data.ward_id ?? null,
    priority: parsed.data.priority,
    userId: req.user!.userId,
    status: "pending",
  }).returning();

  await db.insert(complaintUpdatesTable).values({
    complaintId: complaint.id,
    status: "pending",
    note: "Complaint submitted",
    updatedById: req.user!.userId,
  });

  const [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, complaint.categoryId)).limit(1);
  const adminTokens = await getAdminTokens();
  notifyMany(adminTokens, {
    title: `New Complaint: ${category?.name ?? "Unknown"}`,
    body: complaint.title,
    data: { type: "new_complaint", complaintId: String(complaint.id), priority: complaint.priority },
  });

  res.status(201).json({ success: true, data: formatComplaint(complaint), message: "Complaint submitted" });
});

// GET /api/complaints/nearby
router.get("/complaints/nearby", requireAuth, async (req, res) => {
  const lat = parseFloat(String(req.query.lat));
  const lng = parseFloat(String(req.query.lng));
  const radius = parseFloat(String(req.query.radius ?? "5"));

  if (isNaN(lat) || isNaN(lng)) {
    res.status(400).json({ success: false, message: "lat and lng are required" });
    return;
  }

  const latDelta = radius / 111.0;
  const lngDelta = radius / (111.0 * Math.cos((lat * Math.PI) / 180));

  const complaints = await db
    .select()
    .from(complaintsTable)
    .where(and(
      gte(complaintsTable.latitude, lat - latDelta),
      lte(complaintsTable.latitude, lat + latDelta),
      gte(complaintsTable.longitude, lng - lngDelta),
      lte(complaintsTable.longitude, lng + lngDelta),
    ))
    .orderBy(desc(complaintsTable.createdAt))
    .limit(100);

  res.json({ success: true, data: complaints.map(formatComplaint), message: "OK" });
});

// GET /api/complaints/assigned — for workers
router.get("/complaints/assigned", requireAuth, requireRole("worker", "admin"), async (req, res) => {
  const data = await db
    .select()
    .from(complaintsTable)
    .where(eq(complaintsTable.assignedTo, req.user!.userId))
    .orderBy(desc(complaintsTable.createdAt));

  res.json({ success: true, data: data.map(formatComplaint), message: "OK" });
});

// GET /api/complaints/:id
router.get("/complaints/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ success: false, message: "Invalid ID" });
    return;
  }

  const [complaint] = await db.select().from(complaintsTable).where(eq(complaintsTable.id, id)).limit(1);
  if (!complaint) {
    res.status(404).json({ success: false, message: "Complaint not found" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, complaint.userId)).limit(1);
  const [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, complaint.categoryId)).limit(1);

  let assignedWorker = null;
  if (complaint.assignedTo) {
    const [worker] = await db.select().from(usersTable).where(eq(usersTable.id, complaint.assignedTo)).limit(1);
    assignedWorker = safeUser(worker);
  }

  const updates = await db.select().from(complaintUpdatesTable).where(eq(complaintUpdatesTable.complaintId, id)).orderBy(desc(complaintUpdatesTable.createdAt));
  const updatesWithUser = await Promise.all(
    updates.map(async (update) => {
      const [updatedBy] = await db.select().from(usersTable).where(eq(usersTable.id, update.updatedById)).limit(1);
      return { ...update, updated_by: safeUser(updatedBy) };
    })
  );

  const [{ upvoteCount }] = await db.select({ upvoteCount: count() }).from(upvotesTable).where(eq(upvotesTable.complaintId, id));
  const [{ commentCount }] = await db.select({ commentCount: count() }).from(commentsTable).where(eq(commentsTable.complaintId, id));

  res.json({
    success: true,
    data: {
      ...formatComplaint(complaint),
      upvote_count: upvoteCount,
      comment_count: commentCount,
      user: safeUser(user),
      category: category ? { category_id: category.id, id: category.id, name: category.name, icon: category.icon } : null,
      assigned_worker: assignedWorker,
      updates: updatesWithUser,
    },
    message: "OK",
  });
});

// PUT /api/complaints/:id/status
router.put("/complaints/:id/status", requireAuth, requireRole("admin", "worker"), async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ success: false, message: "Invalid ID" });
    return;
  }

  const schema = z.object({
    status: z.enum(["pending", "assigned", "in_progress", "resolved", "closed"]),
    note: z.string().optional(),
    progress: z.number().int().min(0).max(100).optional(),
    progress_percent: z.number().int().min(0).max(100).optional(),
    image_url: z.string().optional(),
    imageUrl: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(complaintsTable).where(eq(complaintsTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ success: false, message: "Complaint not found" });
    return;
  }

  const progress = parsed.data.progress ?? parsed.data.progress_percent;
  const imageUrl = parsed.data.image_url ?? parsed.data.imageUrl;

  const [updated] = await db.update(complaintsTable)
    .set({
      status: parsed.data.status,
      updatedAt: new Date(),
      progressPercent: progress ?? existing.progressPercent,
      resolutionImageUrl: imageUrl ?? existing.resolutionImageUrl,
    })
    .where(eq(complaintsTable.id, id))
    .returning();

  await db.insert(complaintUpdatesTable).values({
    complaintId: id,
    status: parsed.data.status,
    note: parsed.data.note ?? null,
    progressPercent: progress ?? null,
    imageUrl: imageUrl ?? null,
    updatedById: req.user!.userId,
  });

  const [owner] = await db.select({ fcmToken: usersTable.fcmToken }).from(usersTable).where(eq(usersTable.id, existing.userId)).limit(1);
  notify(owner?.fcmToken, {
    title: `Complaint Update: ${statusLabel(parsed.data.status)}`,
    body: parsed.data.note ? `${existing.title} — ${parsed.data.note}` : `Your complaint "${existing.title}" is now ${statusLabel(parsed.data.status)}.`,
    data: { type: "status_update", complaintId: String(id), status: parsed.data.status },
  });

  res.json({ success: true, data: formatComplaint(updated), message: "Status updated" });
});

// POST /api/complaints/:id/assign
router.post("/complaints/:id/assign", requireAuth, requireRole("admin"), async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ success: false, message: "Invalid ID" });
    return;
  }

  const schema = z.object({
    worker_id: z.number().int().positive().optional(),
    workerId: z.number().int().positive().optional(),
    note: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: parsed.error.message });
    return;
  }

  const workerId = parsed.data.worker_id ?? parsed.data.workerId;
  if (!workerId) {
    res.status(400).json({ success: false, message: "worker_id is required" });
    return;
  }

  const [existing] = await db.select().from(complaintsTable).where(eq(complaintsTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ success: false, message: "Complaint not found" });
    return;
  }

  const [updated] = await db.update(complaintsTable)
    .set({ assignedTo: workerId, status: "assigned", updatedAt: new Date() })
    .where(eq(complaintsTable.id, id))
    .returning();

  const note = parsed.data.note ?? `Assigned to worker ID ${workerId}`;
  await db.insert(complaintUpdatesTable).values({
    complaintId: id,
    status: "assigned",
    note,
    updatedById: req.user!.userId,
  });

  const [owner, worker] = await Promise.all([
    db.select({ fcmToken: usersTable.fcmToken }).from(usersTable).where(eq(usersTable.id, existing.userId)).limit(1).then((r) => r[0]),
    db.select({ fcmToken: usersTable.fcmToken }).from(usersTable).where(eq(usersTable.id, workerId)).limit(1).then((r) => r[0]),
  ]);

  notify(owner?.fcmToken, { title: "Complaint Assigned", body: `Your complaint "${existing.title}" has been assigned to a field worker.`, data: { type: "complaint_assigned", complaintId: String(id) } });
  notify(worker?.fcmToken, { title: "New Task Assigned", body: `You have been assigned to: ${existing.title}`, data: { type: "worker_assigned", complaintId: String(id) } });

  res.json({ success: true, data: formatComplaint(updated), message: "Complaint assigned" });
});

// GET /api/complaints/:id/updates
router.get("/complaints/:id/updates", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ success: false, message: "Invalid ID" });
    return;
  }
  const updates = await db.select().from(complaintUpdatesTable).where(eq(complaintUpdatesTable.complaintId, id)).orderBy(desc(complaintUpdatesTable.createdAt));
  res.json({ success: true, data: updates, message: "OK" });
});

// POST /api/complaints/:id/upvote — toggle upvote
router.post("/complaints/:id/upvote", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ success: false, message: "Invalid ID" });
    return;
  }

  const [existing] = await db.select().from(upvotesTable).where(and(eq(upvotesTable.complaintId, id), eq(upvotesTable.userId, req.user!.userId))).limit(1);

  if (existing) {
    await db.delete(upvotesTable).where(and(eq(upvotesTable.complaintId, id), eq(upvotesTable.userId, req.user!.userId)));
    await db.update(complaintsTable).set({ upvoteCount: sql`${complaintsTable.upvoteCount} - 1`, updatedAt: new Date() }).where(eq(complaintsTable.id, id));
    res.json({ success: true, data: { upvoted: false }, message: "Upvote removed" });
  } else {
    await db.insert(upvotesTable).values({ complaintId: id, userId: req.user!.userId });
    await db.update(complaintsTable).set({ upvoteCount: sql`${complaintsTable.upvoteCount} + 1`, updatedAt: new Date() }).where(eq(complaintsTable.id, id));
    res.json({ success: true, data: { upvoted: true }, message: "Upvoted" });
  }
});

// POST /api/complaints/:id/save — toggle save
router.post("/complaints/:id/save", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ success: false, message: "Invalid ID" });
    return;
  }

  const [existing] = await db.select().from(savesTable).where(and(eq(savesTable.complaintId, id), eq(savesTable.userId, req.user!.userId))).limit(1);

  if (existing) {
    await db.delete(savesTable).where(and(eq(savesTable.complaintId, id), eq(savesTable.userId, req.user!.userId)));
    res.json({ success: true, data: { saved: false }, message: "Removed from saved" });
  } else {
    await db.insert(savesTable).values({ complaintId: id, userId: req.user!.userId });
    res.json({ success: true, data: { saved: true }, message: "Saved" });
  }
});

// GET /api/complaints/:id/comments
router.get("/complaints/:id/comments", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ success: false, message: "Invalid ID" });
    return;
  }
  const comments = await db.select().from(commentsTable).where(eq(commentsTable.complaintId, id)).orderBy(desc(commentsTable.createdAt));
  const withUser = await Promise.all(
    comments.map(async (c) => {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, c.userId)).limit(1);
      return { ...c, user: safeUser(user) };
    })
  );
  res.json({ success: true, data: withUser, message: "OK" });
});

// POST /api/complaints/:id/comments
router.post("/complaints/:id/comments", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ success: false, message: "Invalid ID" });
    return;
  }
  const schema = z.object({ text: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "text is required" });
    return;
  }
  const [comment] = await db.insert(commentsTable).values({
    complaintId: id,
    userId: req.user!.userId,
    text: parsed.data.text,
  }).returning();
  res.status(201).json({ success: true, data: comment, message: "Comment added" });
});

export default router;
