import { Store, MemoryStore, FileStore } from '@netdrive-sdk/core'

export class MemoryCookieStore extends MemoryStore<string> {}

export class FileCookieStore extends FileStore<string> {}

interface Response {
  zt: number
  info: any
}

export interface LanZouClientOptions {
  username: string
  password: string
  cookieStore?: Store<string>
}
