import type { Response } from "express";

import { HTTP_STATUS } from "../constants/http-status.ts";

export const sendSuccess = <T>(
  res: Response,
  options: { message: string; data: T; statusCode?: number }
): Response => {
  const response = {
    success: true,
    message: options.message,
    data: options.data,
  };

  return res.status(options.statusCode ?? HTTP_STATUS.OK).json(response);
};

export const sendError = (
  res: Response,
  message: string,
  code: string = "INTERNAL_SERVER_ERROR",
  statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR
): Response => {
  return res.status(statusCode).json({
    success: false,
    message,
    error: { code },
  });
};