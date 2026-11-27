import { z } from "zod";

export const validate = (schema: z.ZodObject<any, any>) => {
  return (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        success: false,
        message: "Validation error",
        error: {
          code: "VALIDATION_ERROR",
          details: result.error.issues.map((issue: any) => ({
            field: issue.path.join("."),
            message: issue.message,
            code: issue.code,
          })),
        },
      });
      return;
    }

    req.body = result.data;
    next();
  };
};
