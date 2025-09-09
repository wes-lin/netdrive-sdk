import { CacheStore } from './index'

export class MemoryCacheStore implements CacheStore {
  private store: Map<string, { value: any; expires?: number }> = new Map()

  get(key: string) {
    const item = this.store.get(key)
    if (!item) return undefined

    // 检查是否过期
    if (item.expires && item.expires < Date.now()) {
      this.store.delete(key)
      return undefined
    }

    return item.value
  }
  set(key: string, value: any, ttl?: number | undefined): void {
    const expires = ttl ? Date.now() + ttl : undefined
    this.store.set(key, { value, expires })
  }
  delete(key: string): void {
    this.store.delete(key)
  }
  clear(): void {
    this.store.clear()
  }
}
