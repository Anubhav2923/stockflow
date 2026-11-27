// Centralized error handler - no logger dependency
export const errorHandler = (
  err: any,
  _req: import("express").Request,
  res: import("express").Response,
  _next: import("express").NextFunction
) => {
  console.error("Error:", err.message);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    error: { code: err.code || "INTERNAL_SERVER_ERROR" },
  });
};