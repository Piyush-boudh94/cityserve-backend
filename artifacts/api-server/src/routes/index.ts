import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import wardsRouter from "./wards.js";
import categoriesRouter from "./categories.js";
import complaintsRouter from "./complaints.js";
import dashboardRouter from "./dashboard.js";
import usersRouter from "./users.js";
import alertsRouter from "./alerts.js";
import leaderboardRouter from "./leaderboard.js";
import storageRouter from "./storage.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(authRouter);
router.use(wardsRouter);
router.use(categoriesRouter);
router.use(complaintsRouter);
router.use(dashboardRouter);
router.use(usersRouter);
router.use(alertsRouter);
router.use(leaderboardRouter);

export default router;
