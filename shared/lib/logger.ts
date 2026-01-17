type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: string;
    context?: Record<string, unknown>;
    error?: Error;
}

class Logger {
    private formatLog(
        level: LogLevel,
        message: string,
        context?: Record<string, unknown>,
        error?: Error
    ): LogEntry {
        return {
            level,
            message,
            timestamp: new Date().toISOString(),
            ...(context && { context }),
            ...(error && {
                error: {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                }
            })
        };
    }

    private log(
        level: LogLevel,
        message: string,
        context?: Record<string, unknown>,
        error?: Error
    ): void {
        const entry = this.formatLog(level, message, context, error);

        if (process.env.NODE_ENV === 'production') {
            // In production, log as JSON for log aggregation
            console.log(JSON.stringify(entry));
        } else {
            // In development, log with colors
            const prefix = `[${entry.timestamp}] [${level.toUpperCase()}]`;
            if (error) {
                console.error(prefix, message, context, error);
            } else {
                console.log(prefix, message, context || '');
            }
        }
    }

    debug(message: string, context?: Record<string, unknown>): void {
        if (process.env.NODE_ENV === 'development') {
            this.log('debug', message, context);
        }
    }

    info(message: string, context?: Record<string, unknown>): void {
        this.log('info', message, context);
    }

    warn(message: string, context?: Record<string, unknown>): void {
        this.log('warn', message, context);
    }

    error(message: string, error?: Error, context?: Record<string, unknown>): void {
        this.log('error', message, context, error);
    }
}

export const logger = new Logger();
