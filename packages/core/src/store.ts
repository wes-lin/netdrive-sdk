import * as fs from 'node:fs'
import * as promisesFs from 'node:fs/promises'
import path from 'node:path'

export type Store<T> = {
  set(value: T): Promise<void> | void

  get(): Promise<T | null> | T | null
}

export class MemoryStore<T> implements Store<T> {
  _value: T | null

  constructor() {
    this._value = null
  }

  set(_value: T) {
    this._value = _value
  }

  get(): T | null {
    return this._value
  }
}

export class FileStore<T> extends MemoryStore<T> {
  filePath: string
  constructor(filePath: string) {
    super()
    this.filePath = filePath
    if (!filePath) {
      throw new Error('Unknown file for read/write token')
    }

    this.ensureTokenDirectory(filePath)
    const dataJson = this.#loadFromFile(filePath)

    if (dataJson) {
      super.set(dataJson)
    }
  }

  private ensureTokenDirectory(filePath: string) {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }

  set(_value: T) {
    super.set(_value)
    this.#saveToFile(this.filePath, _value)
  }

  #loadFromFile(filePath: string) {
    let data = null
    if (fs.existsSync(filePath)) {
      data = fs.readFileSync(filePath, {
        encoding: 'utf-8'
      }) as T
    }
    return data
  }

  #saveToFile(filePath: string, data: T) {
    return promisesFs.writeFile(filePath, JSON.stringify(data || ''), {
      encoding: 'utf-8'
    })
  }
}
