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