import jwt from 'jsonwebtoken';
import type { RequestHandler } from 'express';


import { ApiError } from "../../../errors/app-error.ts";
import { authEnv } from "../auth.validation.ts";

export const authenticate: RequestHandler = (
    req, res, next
): void => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        throw new ApiError(
            "Authentication required",
            401,
            "unauthorized"
        );
    }

    const match = /^Bearer\s+(\S+)$/i.exec(authorization);
    const token = match?.[1];

    if (!token) {
        throw new ApiError(
            "Invalid authorization header",
            401,
            "unauthorized"
        );
    }

    try {
        const decoded = jwt.verify(
            token,
            authEnv.JWT_SECRET, {
                algorithms: ["HS256"],
                issuer: "stockflow",
                audience: "stockflow-api"
            }
        );

        (res as any).locals.userId = (decoded as { sub: string }).sub;
    } catch (error) {
        throw new ApiError(
            "Invalid or expired token",
            401,
            "Unauthorized"
        );
    }

    next();
};