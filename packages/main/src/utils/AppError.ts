// NexusPOS — Error Service

export interface NormalizedError {
  code: string;
  message: string;
  recoverable: boolean;
  stack?: string;
}

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly recoverable = true,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ErrorService {
  static normalize(error: unknown): NormalizedError {
    if (error instanceof AppError) {
      return {
        code: error.code,
        message: error.message,
        recoverable: error.recoverable,
        stack: error.stack,
      };
    }

    if (error instanceof Error) {
      return {
        code: 'UNKNOWN_ERROR',
        message: error.message,
        recoverable: true,
        stack: error.stack,
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: String(error),
      recoverable: true,
    };
  }

  static capture(code: string, error: unknown, context?: Record<string, unknown>): void {
    const normalized = this.normalize(error);
    console.error(`[ErrorService] ${code}:`, normalized.message, context ?? '');
  }

  static fatal(code: string, error: unknown): void {
    const normalized = this.normalize(error);
    console.error(`[FATAL] ${code}:`, normalized.message);
    // In production: write to error log file, show dialog
  }
}
