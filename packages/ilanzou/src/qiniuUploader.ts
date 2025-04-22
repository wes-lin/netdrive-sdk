import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import got from 'got'
import FormData from 'form-data'
import { logger } from './log'

// 类型定义
interface QiniuConfig {
  uploadDomain: string
  chunkSize: number
}

interface UploadPart {
  partNumber: number
  etag: string
}

interface UploadResult {
  token: string
}

interface UploadProgress {
  type: 'simple' | 'multipart'
  loaded: number
  total: number
  percent: number
  partNumber?: number
  partCount?: number
}

type ProgressCallback = (progress: UploadProgress) => void

// 七牛云分块上传配置
const QINIU_CONFIG: QiniuConfig = {
  // 从uptoken中解析出的上传域名，通常是 'upload.qiniup.com' 或其他区域域名
  uploadDomain: 'upload.qiniup.com',
  // 分块大小（4MB，七牛云推荐的大小）
  chunkSize: 4 * 1024 * 1024
}

/**
 * 对key进行URL安全的Base64编码
 * @param key 要编码的key
 * @returns 编码后的字符串
 */
function encodeKey(key: string): string {
  return Buffer.from(key).toString('base64').replace(/\+/g, '-').replace(/\//g, '_')
}

/**
 * 直接上传小文件（小于分块大小）
 */
export async function simpleUpload(
  uptoken: string,
  filePath: string,
  key: string
): Promise<UploadResult> {
  const url = `https://${QINIU_CONFIG.uploadDomain}`

  const fileData = await fs.promises.readFile(filePath)
  const form = new FormData()
  const fileName = path.basename(filePath)
  form.append('token', uptoken)
  form.append('file', fileData)
  form.append('key', key)
  form.append('fname', fileName)
  return await got
    .post(url, {
      body: form,
      headers: form.getHeaders()
    })
    .on('uploadProgress', (progress) => {
      logger.info(`${fileName}:⬆️  transferred ${progress.transferred}/${progress.total}`)
    })
    .json()
}

/**
 * 初始化分块上传
 * @param uptoken 七牛云上传凭证
 * @param key 文件key（可选）
 * @returns Promise<string> uploadId
 */
async function initMultipartUpload(bucket: string, uptoken: string, key: string): Promise<string> {
  const url = `https://${QINIU_CONFIG.uploadDomain}/buckets/${bucket}/objects/${key}/uploads`

  const response = await got
    .post(url, {
      headers: {
        Authorization: `UpToken ${uptoken}`
      }
    })
    .json<{ uploadId: string }>()

  return response.uploadId
}

/**
 * 上传单个分块
 */
async function uploadPart(
  bucket: string,
  uptoken: string,
  uploadId: string,
  key: string,
  partNumber: number,
  chunkData: Buffer,
  fname: string
): Promise<{ etag: string }> {
  const url = `https://${QINIU_CONFIG.uploadDomain}/buckets/${bucket}/objects/${key}/uploads/${uploadId}/${partNumber}`
  const etag = crypto.createHash('md5').update(chunkData).digest('hex')

  return got
    .put(url, {
      headers: {
        Authorization: `UpToken ${uptoken}`,
        'Content-Type': 'application/octet-stream',
        'Content-MD5': Buffer.from(etag, 'hex').toString('base64')
      },
      body: chunkData
    })
    .on('uploadProgress', (progress) => {
      logger.info(
        `${fname}-part${partNumber}:⬆️  transferred ${progress.transferred}/${progress.total}`
      )
    })
    .json<{ etag: string }>()
}

/**
 * 完成分块上传
 * @param uptoken 七牛云上传凭证
 * @param uploadId 上传ID
 * @param key 文件key（可选）
 * @param parts 所有分块信息
 * @param fileEtag 整个文件的etag
 * @returns Promise<{token: string}> 上传结果
 */
async function completeMultipartUpload(
  bucket: string,
  uptoken: string,
  uploadId: string,
  key: string,
  fname: string,
  parts: UploadPart[]
): Promise<UploadResult> {
  const url = `https://${QINIU_CONFIG.uploadDomain}/buckets/${bucket}/objects/${key}/uploads/${uploadId}`

  // 按照partNumber排序
  const sortedParts = [...parts].sort((a, b) => a.partNumber - b.partNumber)

  return await got
    .post(url, {
      headers: {
        Authorization: `UpToken ${uptoken}`
      },
      json: {
        parts: sortedParts,
        fname
      }
    })
    .json()
}

/**
 * 分块上传大文件
 */
export async function multipartUpload(
  bucket: string,
  uptoken: string,
  filePath: string,
  key: string
): Promise<{
  token: string
}> {
  const fileStats = await fs.promises.stat(filePath)
  const fileName = path.basename(filePath)
  const keyBase64 = encodeKey(key)

  // 1. 初始化分块上传
  const uploadId = await initMultipartUpload(bucket, uptoken, keyBase64)
  logger.info(`Upload ID: ${uploadId}`)

  // 2. 读取文件并分块上传
  const fileSize = fileStats.size
  const chunkSize = QINIU_CONFIG.chunkSize
  const chunkCount = Math.ceil(fileSize / chunkSize)

  const parts: UploadPart[] = []
  const fd = await fs.promises.open(filePath, 'r')
  // 创建并发控制池
  const MAX_CONCURRENT = 5
  const pendingTasks: Promise<{ etag: string; partNumber: number }>[] = []
  // 上传所有分块
  for (let i = 0; i < chunkCount; i++) {
    const partNumber = i + 1
    const position = i * chunkSize
    const length = Math.min(chunkSize, fileSize - position)
    const buffer = Buffer.alloc(length)

    await fd.read(buffer, 0, length, position)

    // 上传当前分块（控制并发数）
    const taskWithCompletion = uploadPart(
      bucket,
      uptoken,
      uploadId,
      keyBase64,
      partNumber,
      buffer,
      fileName
    ).then(({ etag }) => ({ etag, partNumber }))

    pendingTasks.push(taskWithCompletion)

    // 当并发数达到最大值时，等待其中一个任务完成
    if (pendingTasks.length >= MAX_CONCURRENT) {
      await Promise.race(pendingTasks)
    }
  }

  // 等待剩余所有任务完成
  const remainingResults = await Promise.all(pendingTasks)
  remainingResults.forEach(({ etag, partNumber }) => {
    parts.push({
      partNumber,
      etag
    })
  })

  await fd.close()

  // 3. 完成分块上传
  logger.info('Completing multipart upload...')
  const result = await completeMultipartUpload(
    bucket,
    uptoken,
    uploadId,
    keyBase64,
    fileName,
    parts
  )
  logger.info(`Upload completed: ${JSON.stringify(result)}`)

  return result
}

export async function uploadToQiniu(
  bucket: string,
  uptoken: string,
  filePath: string,
  key: string
): Promise<UploadResult> {
  const stats = await fs.promises.stat(filePath)

  if (stats.size <= QINIU_CONFIG.chunkSize) {
    return simpleUpload(uptoken, filePath, key)
  } else {
    return multipartUpload(bucket, uptoken, filePath, key)
  }
}
