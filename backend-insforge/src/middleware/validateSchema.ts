import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validateSchema = (schema: ZodSchema<any>) => 
  (req: Request, res: Response, next: NextFunction): void | Promise<void> => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error: any) {
      if (error instanceof ZodError || error?.name === 'ZodError') {
        const issues = error.errors || error.issues || [];
        const primaryMessage = issues[0]?.message || 'Validation failed';
        res.status(400).json({
          status: 'error',
          message: primaryMessage,
          errors: issues.map((err: any) => ({
            field: err.path ? err.path.join('.') : 'unknown',
            message: err.message,
          })),
        });
        return;
      }
      res.status(500).json({ 
        status: 'error', 
        message: 'Internal server error during validation' 
      });
      return;
    }
  };
