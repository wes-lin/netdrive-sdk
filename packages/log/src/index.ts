import fs from 'fs'
import path from 'path'

type WritableStream = NodeJS.WritableStream

export interface Fields {
  [index: string]: any
}

export type LogLevel = 'info' | 'warn' | 'debug' | 'notice' | 'error'

const LEVEL_LABELS: Record<LogLevel, string> = {
  info: '[INFO]',
  warn: '[WARN]',
  error: '[ERROR]',
  debug: '[DEBUG]',
  notice: '[NOTICE]'
}

export interface LoggerOptions {
  consoleOutput?: boolean
  fileOutput?: boolean
  filePath?: string
  maxFileSize?: number
  maxFiles?: number
  isDebugEnabled?: boolean
}

export class Logger {
  private fileStream: fs.WriteStream | null = null
  private stream: WritableStream
  private currentFileSize = 0
  private options: Required<LoggerOptions>
  private logDirectory: string
  private baseLogPath: string
  private logFileExt: string
  private baseLogName: string

  constructor(options: LoggerOptions = {}, stream?: WritableStream) {
    this.options = {
      consoleOutput: true,
      fileOutput: false,
      filePath: path.join(process.cwd(), 'logs', 'app.log'),
      maxFileSize: 1024 * 1024 * 10, // 10MB
      maxFiles: 5,
      isDebugEnabled: false,
      ...options
    }

    this.logDirectory = path.dirname(this.options.filePath)
    this.baseLogPath = this.options.filePath
    this.logFileExt = path.extname(this.baseLogPath)
    this.baseLogName = path.basename(this.baseLogPath, this.logFileExt)
    this.stream = stream || process.stdout

    if (this.options.fileOutput) {
      this.ensureLogDirectory()
      this.createFileStream()
    }
  }

  configure(newOptions: Partial<LoggerOptions>): void {
    // Merge new options with existing ones
    this.options = {
      ...this.options,
      ...newOptions
    }

    // Handle file output changes
    if (newOptions.fileOutput !== undefined || newOptions.filePath !== undefined) {
      this.close()

      if (this.options.fileOutput) {
        this.logDirectory = path.dirname(this.options.filePath)
        this.baseLogPath = this.options.filePath
        this.logFileExt = path.extname(this.baseLogPath)
        this.baseLogName = path.basename(this.baseLogPath, this.logFileExt)

        this.ensureLogDirectory()
        this.createFileStream()
      }
    }
  }

  messageTransformer: (message: string, level: LogLevel) => string = (it) => it

  private ensureLogDirectory() {
    if (!fs.existsSync(this.logDirectory)) {
      fs.mkdirSync(this.logDirectory, { recursive: true })
    }
  }

  private createFileStream() {
    this.fileStream = fs.createWriteStream(this.baseLogPath, { flags: 'a' })
    this.currentFileSize = fs.existsSync(this.baseLogPath) ? fs.statSync(this.baseLogPath).size : 0
  }

  private rotateLogFile() {
    if (!this.fileStream || !this.options.fileOutput) return

    this.fileStream.end()

    // Delete oldest file if we've reached max files
    const oldestFile = path.join(
      this.logDirectory,
      `${this.baseLogName}.${this.options.maxFiles}${this.logFileExt}`
    )
    if (fs.existsSync(oldestFile)) {
      fs.unlinkSync(oldestFile)
    }

    // Rename existing files
    for (let i = this.options.maxFiles - 1; i >= 1; i--) {
      const oldFile = path.join(this.logDirectory, `${this.baseLogName}.${i}${this.logFileExt}`)
      const newFile = path.join(this.logDirectory, `${this.baseLogName}.${i + 1}${this.logFileExt}`)
      if (fs.existsSync(oldFile)) {
        fs.renameSync(oldFile, newFile)
      }
    }

    // Rename current file to .1
    fs.renameSync(
      this.baseLogPath,
      path.join(this.logDirectory, `${this.baseLogName}.1${this.logFileExt}`)
    )

    // Create new file stream
    this.createFileStream()
    this.currentFileSize = 0
  }

  private writeToFile(message: string) {
    if (!this.fileStream || !this.options.fileOutput) return

    const data = `${message}\n`
    this.currentFileSize += Buffer.byteLength(data)

    if (this.currentFileSize > this.options.maxFileSize) {
      this.rotateLogFile()
    }

    this.fileStream.write(data)
  }

  info(message?: any) {
    this._doLog(message, 'info')
  }

  error(message?: any) {
    this._doLog(message, 'error')
  }

  warn(message?: any): void {
    this._doLog(message, 'warn')
  }

  debug(message?: any) {
    if (this.options.isDebugEnabled) {
      this._doLog(message, 'debug')
    }
  }

  notice(message?: any) {
    this._doLog(message, 'notice')
  }

  private getTimestamp(): string {
    return new Date()
      .toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
      .replace(/\//g, '-')
  }

  private _doLog(message: any, level: LogLevel) {
    let messageStr = 'undefined'
    if (message === null) {
      messageStr = 'null'
    } else if (message instanceof Error) {
      messageStr = message.stack || message.toString()
    } else if (typeof message === "string") {
      messageStr = message
    } else {
      messageStr = JSON.stringify(message)
    }
    const timestamp = this.getTimestamp()
    const levelLabel = LEVEL_LABELS[level]
    const formattedMessage = `[${timestamp}] ${levelLabel} ${this.messageTransformer(
      messageStr,
      level
    )}\n`

    if (this.options.consoleOutput) {
      this.stream.write(formattedMessage)
    }

    if (this.options.fileOutput) {
      this.writeToFile(formattedMessage.trim())
    }
  }

  close(): void {
    if (this.fileStream) {
      this.fileStream.end()
      this.fileStream = null
    }
  }
}
