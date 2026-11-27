import { Router } from "express";
import { rateLimit } from "express-rate-limit";

import * as authController from "./auth.controller.js";
import { loginSchema } from "./auth.validation.js";
import { authenticate } from "./middleware/auth.middleware.js";

import { validate } from "../../middleware/validate.middleware.js";
import { ApiError } from "../../errors/app-error.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,

  handler: (_req, _res, next) => {
    next(
      new ApiError(
        "Too many login attempts. Try again later.",
        429,
        "RATE_LIMIT_EXCEEDED"
      )
    );
  },
});

router.post(
  "/credentials",
  loginLimiter,
  async (_req, res, next) => {
    const password = process.env.ADMIN_PASSWORD;
    if (!password) throw new ApiError("One-click login is not configured", 503, "LOGIN_UNAVAILABLE");
    res.locals.loginCredentials = { username: process.env.ADMIN_USERNAME || "admin", password };
    next();
  },
  authController.login
);

router.post(
  "/login",
  loginLimiter,
  validate(loginSchema),
  authController.login
);

router.get(
  "/me",
  authenticate,
  authController.getCurrentUser
);

router.post(
  "/logout",
  authenticate,
  authController.logout
);

export default router;
