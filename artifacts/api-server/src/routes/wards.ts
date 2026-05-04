import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { wardsTable } from "@workspace/db/schema";

const router: IRouter = Router();

router.get("/wards", async (_req, res) => {
  const wards = await db.select().from(wardsTable).orderBy(wardsTable.wardNumber);
  res.json({
    success: true,
    data: wards.map((w) => ({
      ward_id: w.wardId,
      id: w.id,
      name: w.name,
      ward_number: w.wardNumber,
      city_name: w.cityName,
    })),
    message: "OK",
  });
});

export default router;
