// NexusPOS — App Logger

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class AppLogger {
  constructor(private readonly context: string) {}

  private log(level: LogLevel, message: string, ...args: unknown[]) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${this.context}]`;

    switch (level) {
      case 'debug': if (process.env.NODE_ENV === 'development') console.debug(prefix, message, ...args); break;
      case 'info': console.info(prefix, message, ...args); break;
      case 'warn': console.warn(prefix, message, ...args); break;
      case 'error': console.error(prefix, message, ...args); break;
    }
  }

  debug(msg: string, ...args: unknown[]) { this.log('debug', msg, ...args); }
  info(msg: string, ...args: unknown[]) { this.log('info', msg, ...args); }
  warn(msg: string, ...args: unknown[]) { this.log('warn', msg, ...args); }
  error(msg: string, ...args: unknown[]) { this.log('error', msg, ...args); }
}
