import { Response } from 'express';

interface ApiResponseOptions<T> {
  res: Response;
  statusCode?: number;
  success?: boolean;
  message: string;
  data?: T;
}

export class ApiResponse {
  static send<T>({ res, statusCode = 200, success = true, message, data }: ApiResponseOptions<T>): void {
    const response: { success: boolean; message: string; data?: T } = {
      success,
      message,
    };

    if (data !== undefined) {
      response.data = data;
    }

    res.status(statusCode).json(response);
  }

  static ok<T>(res: Response, message: string, data?: T): void {
    this.send({ res, statusCode: 200, message, data });
  }

  static success<T>(res: Response, message: string, data?: T): void {
    this.send({ res, statusCode: 200, message, data });
  }

  static created<T>(res: Response, message: string, data?: T): void {
    this.send({ res, statusCode: 201, message, data });
  }

  static noContent(res: Response): void {
    res.status(204).send();
  }

  static error(res: Response, message: string, error?: string, statusCode: number = 400): void {
    const response: { success: boolean; message: string; error?: string } = {
      success: false,
      message,
    };

    if (error !== undefined) {
      response.error = error;
    }

    res.status(statusCode).json(response);
  }
}
