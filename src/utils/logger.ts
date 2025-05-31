import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { Logger } from '../types';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  extra?: Record<string, any>;
}

export class IndexerLogger implements Logger {
  private level: LogLevel;
  private filePath?: string;
  private logLevels: Record<LogLevel, number> = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
  };

  constructor(level: LogLevel = 'info', filePath?: string) {
    this.level = level;
    this.filePath = filePath;
    
    if (this.filePath) {
      this.ensureLogDirectory();
    }
  }

  private ensureLogDirectory(): void {
    if (!this.filePath) return;
    
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return this.logLevels[level] <= this.logLevels[this.level];
  }

  private formatMessage(level: LogLevel, message: string, extra?: Record<string, any>): string {
    const timestamp = new Date().toISOString();

    // Console format (colored)
    const colors = {
      error: '\x1b[31m', // Red
      warn: '\x1b[33m',  // Yellow
      info: '\x1b[36m',  // Cyan
      debug: '\x1b[90m'  // Gray
    };
    
    const reset = '\x1b[0m';
    const color = colors[level];
    
    const consoleMessage = `${color}[${timestamp}] ${level.toUpperCase()}${reset}: ${message}`;
    const extraFormatted = extra ? ` ${JSON.stringify(extra, this.bigIntReplacer)}` : '';
    
    return consoleMessage + extraFormatted;
  }

  private formatFileMessage(level: LogLevel, message: string, extra?: Record<string, any>): string {
    const timestamp = new Date().toISOString();
    const logEntry: LogEntry = {
      timestamp,
      level,
      message,
      ...(extra && { extra })
    };

    return JSON.stringify(logEntry, this.bigIntReplacer) + '\n';
  }

  private writeToFile(content: string): void {
    if (!this.filePath) return;
    
    try {
      const logFile = join(this.filePath, `indexer-${new Date().toISOString().split('T')[0]}.log`);
      appendFileSync(logFile, content);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  error(message: string, extra?: Record<string, any>): void {
    if (!this.shouldLog('error')) return;
    
    const consoleMessage = this.formatMessage('error', message, extra);
    console.error(consoleMessage);
    
    if (this.filePath) {
      const fileMessage = this.formatFileMessage('error', message, extra);
      this.writeToFile(fileMessage);
    }
  }

  warn(message: string, extra?: Record<string, any>): void {
    if (!this.shouldLog('warn')) return;
    
    const consoleMessage = this.formatMessage('warn', message, extra);
    console.warn(consoleMessage);
    
    if (this.filePath) {
      const fileMessage = this.formatFileMessage('warn', message, extra);
      this.writeToFile(fileMessage);
    }
  }

  info(message: string, extra?: Record<string, any>): void {
    if (!this.shouldLog('info')) return;
    
    const consoleMessage = this.formatMessage('info', message, extra);
    console.log(consoleMessage);
    
    if (this.filePath) {
      const fileMessage = this.formatFileMessage('info', message, extra);
      this.writeToFile(fileMessage);
    }
  }

  debug(message: string, extra?: Record<string, any>): void {
    if (!this.shouldLog('debug')) return;
    
    const consoleMessage = this.formatMessage('debug', message, extra);
    console.log(consoleMessage);
    
    if (this.filePath) {
      const fileMessage = this.formatFileMessage('debug', message, extra);
      this.writeToFile(fileMessage);
    }
  }

  // Utility methods
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  // BigInt serialization helper
  private bigIntReplacer(key: string, value: any): any {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  }
} 