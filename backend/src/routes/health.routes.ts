import { Router } from "express";

const router = Router();

router.get("/", (_, res) => {
  res.json({ success: true, message: "OK", data: { status: "healthy" } });
});

export default router;