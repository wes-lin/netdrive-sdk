import { MemoryStore, FileStore } from '@netdrive-sdk/core'

export class MemoryCookieStore extends MemoryStore<string> {}

export class FileCookieStore extends FileStore<string> {}
