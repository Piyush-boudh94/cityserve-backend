import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, complaintsTable } from "@workspace/db/schema";
import { eq, count, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/leaderboard", requireAuth, async (_req, res) => {
  const citizens = await db
    .select({ id: usersTable.id, fullName: usersTable.fullName, avatarUrl: usersTable.avatarUrl, wardId: usersTable.wardId })
    .from(usersTable)
    .where(eq(usersTable.role, "citizen"))
    .limit(50);

  const leaderboard = await Promise.all(
    citizens.map(async (u) => {
      const [{ total }] = await db.select({ total: count() }).from(complaintsTable).where(eq(complaintsTable.userId, u.id));
      return {
        user_id: u.id,
        id: u.id,
        full_name: u.fullName,
        avatar_url: u.avatarUrl ?? null,
        ward_id: u.wardId ?? null,
        complaint_count: total,
        points: total * 10,
      };
    })
  );

  leaderboard.sort((a, b) => b.complaint_count - a.complaint_count);

  res.json({ success: true, data: leaderboard.slice(0, 20), message: "OK" });
});

export default router;
