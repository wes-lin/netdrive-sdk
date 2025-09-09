import { MemoryCacheStore } from './MemoryCacheStore'

export interface CacheStore {
  get(key: string): any
  set(key: string, value: any, ttl?: number): void
  delete(key: string): void
  clear(): void
}

// 缓存配置接口
export interface CacheOptions {
  ttl?: number // 缓存时间（毫秒）
  key?: string // 自定义缓存键
  store?: CacheStore // 缓存存储
}

// 默认缓存存储
const defaultStore = new MemoryCacheStore()

// 生成缓存键
function generateCacheKey(
  target: any,
  methodName: string,
  args: any[],
  customKey?: string
): string {
  if (customKey) {
    return customKey
  }

  const className = target.constructor.name
  const argsKey = args
    .map((arg) => {
      if (typeof arg === 'object') {
        return JSON.stringify(arg)
      }
      return String(arg)
    })
    .join(':')

  return `${className}:${methodName}:${argsKey}`
}

export function CacheClear(key?: string): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    const methodName = String(propertyKey)

    descriptor.value = function (...args: any[]) {
      const result = originalMethod.apply(this, args)

      // 如果指定了key，清除特定缓存，否则清除所有缓存
      if (key) {
        defaultStore.delete(key)
        console.log(`Cleared cache for key: ${key}`)
      } else {
        defaultStore.clear()
        console.log('Cleared all cache')
      }

      return result
    }

    return descriptor
  }
}

// 缓存装饰器
// @ts-ignore
export function Cache(options: CacheOptions = {}): MethodDecorator {
  const { ttl, key: customKey, store = defaultStore } = options

  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    const methodName = String(propertyKey)

    // 处理异步方法
    if (originalMethod.constructor.name === 'AsyncFunction') {
      descriptor.value = async function (...args: any[]) {
        const cacheKey = generateCacheKey(target, methodName, args, customKey)
        const cachedValue = store.get(cacheKey)

        if (cachedValue !== undefined) {
          console.log(`Async Cache hit for ${cacheKey}`)
          return cachedValue
        }

        console.log(`Async Cache miss for ${cacheKey}`)
        const result = await originalMethod.apply(this, args)
        store.set(cacheKey, result, ttl)
        return result
      }
    } else {
      // 处理同步方法
      descriptor.value = function (...args: any[]) {
        const cacheKey = generateCacheKey(target, methodName, args, customKey)
        const cachedValue = store.get(cacheKey)

        if (cachedValue !== undefined) {
          console.log(`Cache hit for ${cacheKey}`)
          return cachedValue
        }

        console.log(`Cache miss for ${cacheKey}`)
        const result = originalMethod.apply(this, args)
        store.set(cacheKey, result, ttl)
        return result
      }
    }

    return descriptor
  }
}
