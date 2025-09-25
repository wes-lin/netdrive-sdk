import { MemoryStore, FileStore } from '@netdrive-sdk/core'

export class MemoryTokenStore extends MemoryStore<string> {}

export class FileTokenStore extends FileStore<string> {}
