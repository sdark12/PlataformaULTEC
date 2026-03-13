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
      if (error instanceof ZodError) {
        res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: (error as any).errors.map((err: any) => ({
            field: err.path.join('.'),
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
