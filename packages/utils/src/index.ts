import * as crypto from 'crypto'
import { createReadStream, promises } from 'node:fs'
import path from 'path'

const decryptByBase64 = (word: string, key: string, iv?: Buffer) => {
  const keyBuffer = Buffer.from(key, 'utf8')
  const encryptedData = Buffer.from(word, 'base64')
  const decipher = crypto.createDecipheriv('aes-128-ecb', keyBuffer, iv || null)
  decipher.setAutoPadding(true)
  let decrypted = decipher.update(encryptedData)
  decrypted = Buffer.concat([decrypted, decipher.final()])
  return decrypted.toString('utf8')
}

const encrypt2Hex = (word: string, key: string, iv?: Buffer) => {
  const keyBuffer = Buffer.from(key, 'utf8')
  const cipher = crypto.createCipheriv('aes-128-ecb', keyBuffer, iv || null)
  cipher.setAutoPadding(true)
  let encrypted = cipher.update(word, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  return encrypted
}

const computedMD5 = (
  filePath: string
): Promise<{
  md5: string
  size: number
}> => {
  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath)
    const hash = crypto.createHash('md5') // 创建 MD5 哈希对象
    let totalSize = 0
    stream.on('data', (chunk) => {
      totalSize += chunk.length
      hash.update(chunk) // 更新哈希内容
    })

    stream.on('end', () => {
      const md5 = hash.digest('hex') // 计算并返回十六进制格式的哈希值
      resolve({ md5, size: totalSize })
    })

    stream.on('error', (err) => {
      reject(err)
    })
  })
}

async function listAllSubdirectoriesWithoutCurrent(dirPath: string): Promise<string[]> {
  try {
    const items = await promises.readdir(dirPath, { withFileTypes: true })
    let directories: string[] = []

    for (const item of items) {
      const fullPath = path.join(dirPath, item.name)
      if (item.isDirectory()) {
        const subDirs = await listAllSubdirectoriesWithoutCurrent(fullPath)
        directories = directories.concat(subDirs)
      }
    }

    return directories
  } catch (err) {
    console.error('Error reading directory:', err)
    return []
  }
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export {
  decryptByBase64,
  encrypt2Hex,
  computedMD5,
  listAllSubdirectoriesWithoutCurrent,
  delay,
  formatBytes
}
