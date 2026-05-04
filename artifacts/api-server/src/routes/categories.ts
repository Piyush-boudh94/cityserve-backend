import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { categoriesTable } from "@workspace/db/schema";

const router: IRouter = Router();

router.get("/categories", async (_req, res) => {
  const categories = await db.select().from(categoriesTable).orderBy(categoriesTable.id);
  res.json({
    success: true,
    data: categories.map((c) => ({
      category_id: c.id,
      id: c.id,
      name: c.name,
      icon: c.icon,
      description: c.description ?? null,
    })),
    message: "OK",
  });
});

export default router;
