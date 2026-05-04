import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { db } from "@workspace/db";
import { usersTable, otpSessionsTable } from "@workspace/db/schema";
import { eq, or } from "drizzle-orm";
import { signToken, requireAuth } from "../middlewares/auth.js";
import { verifyFirebaseToken, notify } from "../lib/fcm.js";
import { z } from "zod";

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

// POST /api/auth/citizen/firebase — Firebase phone auth token verification
router.post("/auth/citizen/firebase", async (req, res) => {
  const schema = z.object({
    firebase_token: z.string().min(1),
    name: z.string().optional(),
    ward_id: z.number().int().optional(),
    fcm_token: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "firebase_token is required" });
    return;
  }

  const decoded = await verifyFirebaseToken(parsed.data.firebase_token);
  if (!decoded) {
    res.status(401).json({ success: false, message: "Invalid Firebase token" });
    return;
  }

  let [user] = await db
    .select()
    .from(usersTable)
    .where(
      or(
        eq(usersTable.firebaseUid, decoded.uid),
        decoded.phone ? eq(usersTable.phone, decoded.phone) : undefined,
      )
    )
    .limit(1);

  if (!user) {
    const [created] = await db.insert(usersTable).values({
      fullName: parsed.data.name ?? (decoded.phone ? `User ${decoded.phone.slice(-4)}` : "Citizen"),
      phone: decoded.phone ?? null,
      email: decoded.email ?? null,
      firebaseUid: decoded.uid,
      wardId: parsed.data.ward_id ?? null,
      fcmToken: parsed.data.fcm_token ?? null,
      role: "citizen",
      isActive: true,
    }).returning();
    user = created;
  } else {
    const updates: Partial<typeof usersTable.$inferInsert> = {
      firebaseUid: decoded.uid,
      updatedAt: new Date(),
    };
    if (parsed.data.name) updates.fullName = parsed.data.name;
    if (parsed.data.ward_id) updates.wardId = parsed.data.ward_id;
    if (parsed.data.fcm_token) updates.fcmToken = parsed.data.fcm_token;

    const [updated] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, user.id))
      .returning();
    user = updated;
  }

  const token = signToken({ userId: user.id, role: user.role });
  res.json({
    success: true,
    data: { token, access_token: token, user: safeUser(user) },
    message: "Login successful",
  });
});

// POST /api/auth/citizen/request-otp — fallback OTP flow (dev/testing)
router.post("/auth/citizen/request-otp", async (req, res) => {
  const schema = z.object({
    phone: z.string().min(1),
    name: z.string().optional(),
    ward_id: z.number().int().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "phone is required" });
    return;
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const sessionId = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await db.delete(otpSessionsTable).where(eq(otpSessionsTable.phone, parsed.data.phone));
  await db.insert(otpSessionsTable).values({
    phone: parsed.data.phone,
    otp,
    sessionId,
    expiresAt,
  });

  res.json({
    success: true,
    data: { session_id: sessionId, otp_for_testing: otp },
    message: `OTP sent to ${parsed.data.phone}`,
  });
});

// POST /api/auth/citizen/verify-otp — verify OTP and return JWT
router.post("/auth/citizen/verify-otp", async (req, res) => {
  const schema = z.object({
    session_id: z.string().min(1),
    otp: z.string().min(6),
    name: z.string().optional(),
    ward_id: z.number().int().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "session_id and otp are required" });
    return;
  }

  const [session] = await db
    .select()
    .from(otpSessionsTable)
    .where(eq(otpSessionsTable.sessionId, parsed.data.session_id))
    .limit(1);

  if (!session || session.otp !== parsed.data.otp) {
    res.status(401).json({ success: false, message: "Invalid OTP" });
    return;
  }
  if (new Date() > session.expiresAt) {
    res.status(401).json({ success: false, message: "OTP expired" });
    return;
  }

  await db.delete(otpSessionsTable).where(eq(otpSessionsTable.sessionId, parsed.data.session_id));

  let [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.phone, session.phone))
    .limit(1);

  if (!user) {
    const [created] = await db.insert(usersTable).values({
      fullName: parsed.data.name ?? `User ${session.phone.slice(-4)}`,
      phone: session.phone,
      wardId: parsed.data.ward_id ?? null,
      role: "citizen",
      isActive: true,
    }).returning();
    user = created;
  } else if (parsed.data.name || parsed.data.ward_id) {
    const [updated] = await db.update(usersTable).set({
      ...(parsed.data.name ? { fullName: parsed.data.name } : {}),
      ...(parsed.data.ward_id ? { wardId: parsed.data.ward_id } : {}),
      updatedAt: new Date(),
    }).where(eq(usersTable.id, user.id)).returning();
    user = updated;
  }

  const token = signToken({ userId: user.id, role: user.role });
  res.json({
    success: true,
    data: { token, access_token: token, user: safeUser(user) },
    message: "Login successful",
  });
});

// POST /api/auth/admin — Firebase ID token or email+password login for admin/worker
router.post("/auth/admin", async (req, res) => {
  const schema = z.object({
    firebase_token: z.string().optional(),
    email: z.string().email().optional(),
    password: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "Invalid request body" });
    return;
  }

  let user: typeof usersTable.$inferSelect | undefined;

  if (parsed.data.firebase_token) {
    const decoded = await verifyFirebaseToken(parsed.data.firebase_token);
    if (!decoded) {
      res.status(401).json({ success: false, message: "Invalid Firebase token" });
      return;
    }

    const candidates = await db
      .select()
      .from(usersTable)
      .where(
        or(
          eq(usersTable.firebaseUid, decoded.uid),
          decoded.email ? eq(usersTable.email, decoded.email) : undefined,
        )
      )
      .limit(1);
    user = candidates[0];

    if (!user) {
      res.status(403).json({ success: false, message: "Admin account not found. Create it in the database first." });
      return;
    }

    if (user.role === "citizen") {
      res.status(403).json({ success: false, message: "Access denied — not an admin or worker account" });
      return;
    }

    if (!user.firebaseUid) {
      await db.update(usersTable).set({ firebaseUid: decoded.uid, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
    }
  } else if (parsed.data.email && parsed.data.password) {
    const [found] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, parsed.data.email))
      .limit(1);

    if (!found || !found.passwordHash) {
      res.status(401).json({ success: false, message: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(parsed.data.password, found.passwordHash);
    if (!valid) {
      res.status(401).json({ success: false, message: "Invalid credentials" });
      return;
    }

    if (found.role === "citizen") {
      res.status(403).json({ success: false, message: "Access denied — not an admin or worker account" });
      return;
    }
    user = found;
  } else {
    res.status(400).json({ success: false, message: "Provide firebase_token or email+password" });
    return;
  }

  const token = signToken({ userId: user.id, role: user.role });
  res.json({
    success: true,
    data: { token, access_token: token, user: safeUser(user) },
    message: "Login successful",
  });
});

// GET /api/users/me — get current user profile
router.get("/users/me", requireAuth, async (req, res) => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId))
    .limit(1);

  if (!user) {
    res.status(404).json({ success: false, message: "User not found" });
    return;
  }
  res.json({ success: true, data: safeUser(user), message: "OK" });
});

// PUT /api/users/me — update profile
router.put("/users/me", requireAuth, async (req, res) => {
  const schema = z.object({
    name: z.string().min(1).optional(),
    full_name: z.string().min(1).optional(),
    phone: z.string().optional(),
    avatar_url: z.string().optional(),
    ward_id: z.number().int().optional(),
    fcm_token: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: parsed.error.message });
    return;
  }

  const updates: Partial<typeof usersTable.$inferInsert> = { updatedAt: new Date() };
  const name = parsed.data.full_name ?? parsed.data.name;
  if (name) updates.fullName = name;
  if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone;
  if (parsed.data.avatar_url !== undefined) updates.avatarUrl = parsed.data.avatar_url;
  if (parsed.data.ward_id !== undefined) updates.wardId = parsed.data.ward_id;
  if (parsed.data.fcm_token !== undefined) updates.fcmToken = parsed.data.fcm_token;

  const [user] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.user!.userId))
    .returning();

  res.json({ success: true, data: safeUser(user), message: "Profile updated" });
});

// POST /api/auth/fcm-token — update FCM token
router.post("/auth/fcm-token", requireAuth, async (req, res) => {
  const schema = z.object({ token: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "token is required" });
    return;
  }
  await db
    .update(usersTable)
    .set({ fcmToken: parsed.data.token, updatedAt: new Date() })
    .where(eq(usersTable.id, req.user!.userId));

  res.json({ success: true, data: null, message: "FCM token updated" });
});

export default router;
