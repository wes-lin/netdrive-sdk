import * as fs from 'node:fs'
import * as promisesFs from 'node:fs/promises'
import { TokenStore } from './types'
import path from 'node:path'

export class MemoryTokenStore extends TokenStore {
  _appToken: string

  constructor() {
    super()
    this._appToken = ''
  }

  set(token: string) {
    this._appToken = token
  }

  get(): string {
    return this._appToken
  }
}

export class FileTokenStore extends MemoryTokenStore {
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

  set(token: string) {
    super.set(token)
    return this.#saveToFile(this.filePath, token)
  }

  #loadFromFile(filePath: string) {
    let data = null
    if (fs.existsSync(filePath)) {
      data = fs.readFileSync(filePath, {
        encoding: 'utf-8'
      })
    }
    return data
  }

  #saveToFile(filePath: string, data: string) {
    return promisesFs.writeFile(filePath, data, {
      encoding: 'utf-8'
    })
  }
}
