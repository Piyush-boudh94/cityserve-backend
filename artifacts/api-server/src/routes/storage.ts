import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// POST /api/storage/upload — multipart image upload, returns base64 data URL
// In production, replace this with Firebase Storage or Cloudinary
router.post("/storage/upload", requireAuth, upload.single("image"), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ success: false, message: "No image file provided" });
    return;
  }

  const base64 = req.file.buffer.toString("base64");
  const dataUrl = `data:${req.file.mimetype};base64,${base64}`;

  res.json({
    success: true,
    data: {
      url: dataUrl,
      image_url: dataUrl,
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    },
    message: "Image uploaded",
  });
});

export default router;
