import got, { Got } from 'got'
import crypto from 'crypto'
import {
  computedMD5,
  delay,
  encrypt2Hex,
  formatBytes,
} from '@netdrive-sdk/utils'
import {
  LanZouYClientOptions,
  FileInfo,
  ApiResponse,
  PathResponse,
  QiniupFileInfo,
  ShareUrlResponse,
  QiniupUpTokenRequest,
  LanZouYClientConfig
} from './types'
import { MemoryTokenStore } from './store'
import { createReadStream } from 'fs'
import { form_up } from 'qiniu'
import path from 'path'
abstract class ALanZouYClient {
  readonly username
  readonly password
  readonly tokenStore
  readonly config: LanZouYClientConfig
  readonly client: Got

  constructor(config: LanZouYClientConfig, options: LanZouYClientOptions) {
    this.username = options.username
    this.password = options.password
    this.tokenStore = options.tokenStore || new MemoryTokenStore()
    this.config = {
      devModel: 'chrome',
      devVersion: '131',
      devType: '6',
      extra: '2',
      uuid: crypto.randomUUID(),
      ...config
    }

    this.client = got.extend({
      prefixUrl: this.config.apiUrl,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.70 Safari/537.36',
        Origin: this.config.webUrl as string,
        Referer: `${this.config.webUrl}/`
      },
      hooks: {
        beforeRequest: [
          async (options) => {
            const nowTs = new Date().getTime().toString()
            const tsEncode = encrypt2Hex(nowTs, this.config.secret)
            const searchParams = options.url.searchParams
            searchParams.append('uuid', this.config.uuid as string)
            searchParams.append('devType', this.config.devType as string)
            searchParams.append('devCode', this.config.uuid as string)
            searchParams.append('devModel', this.config.devModel as string)
            searchParams.append('devVersion', this.config.devVersion as string)
            searchParams.append('appVersion', '')
            searchParams.append('timestamp', tsEncode)
            searchParams.append('extra', this.config.extra as string)
            if (options.url.pathname.startsWith(`/${this.config.protectURL}`)) {
              const token = await this.getAppToken()
              searchParams.append('appToken', token)
            }
          }
        ],
        afterResponse: [
          (response, retryWithMergedOptions) => {
            try {
              if (response.body) {
                const res = JSON.parse(response.body.toString())
                if ('code' in res && res.code === -2) {
                  this.tokenStore.set('')
                  retryWithMergedOptions({})
                }
              }
            } catch (e) {}

            return response
          }
        ]
      }
    })
  }

  login = (): Promise<{
    appToken: string
  }> =>
    this.client
      .post(`${this.config.publicURL}/login`, {
        json: {
          loginName: this.username,
          loginPwd: this.password
        }
      })
      .json()

  async getAppToken() {
    const token = await this.tokenStore.get()
    if (token) {
      return token
    }
    const res = await this.login()
    this.tokenStore.set(res.appToken)
    return res.appToken
  }

  getFileList = (folderId = 0, offset = 1, limit = 60): Promise<FileInfo> =>
    this.client
      .get(`${this.config.protectURL}/record/file/list`, {
        searchParams: {
          folderId,
          type: 0,
          offset,
          limit
        }
      })
      .json()

  createFolder = (
    parentFolderId: string | number,
    folderName?: string,
    folderDesc?: string,
    pathList?: string[]
  ): Promise<PathResponse> =>
    this.client
      .post(`${this.config.protectURL}/file/folder/save`, {
        json: { folderId: parentFolderId, folderName, folderDesc, pathList }
      })
      .json()

  deleteFile = (value: {
    folderIds?: string | number[]
    fileIds?: string | number[]
  }): Promise<ApiResponse> =>
    this.client
      .post(`${this.config.protectURL}/file/delete`, {
        json: {
          folderIds: value.folderIds?.toString(),
          fileIds: value.fileIds?.toString(),
          status: 0
        }
      })
      .json()

  searchPath = (
    folderId: string
  ): Promise<
    ApiResponse<{
      id: number
      name: string
    }>
  > =>
    this.client
      .get(`${this.config.protectURL}/record/search/path`, {
        searchParams: {
          folderId
        }
      })
      .json()

  getQiniupUpToken = (
    request: QiniupUpTokenRequest
  ): Promise<{
    upToken: string
    map: {
      fileId: string
    }
  }> =>
    this.client
      .post(`${this.config.protectURL}/7n/getUpToken`, {
        json: {
          ...request,
          type: 1
        }
      })
      .json()

  getQiniupResults = (tokenList: string): Promise<QiniupFileInfo> =>
    this.client
      .get(`${this.config.publicURL}/7n/results`, {
        searchParams: {
          tokenList,
          tokenTime: new Date().toString()
        }
      })
      .json()

  shareUrl = (fileId: string): Promise<ShareUrlResponse> =>
    this.client
      .post(`${this.config.protectURL}/share/url`, {
        json: {
          shareId: '',
          fileIds: fileId,
          folderIds: '',
          code: '',
          amt: '',
          term: 0,
          showRecommend: 0,
          showUpTime: 1,
          showDownloads: 1,
          showComments: 1,
          showStars: 1,
          showLikes: 1
        }
      })
      .json()

  uploadFile = async (filePath: string, folderId = 0) => {
    const fileName = path.basename(filePath)
    const fileInfo = await computedMD5(filePath)
    const res = await this.getQiniupUpToken({
      fileName,
      fileSize: fileInfo.size,
      folderId,
      md5: fileInfo.md5
    })
    if (res.upToken === '-1') {
      return res.map.fileId
    } else {
      const formUploader = new form_up.FormUploader()
      const putExtra = new form_up.PutExtra()
      let uploadedBytes = 0
      const startTime = Date.now()
      const file = createReadStream(filePath)
      file.on('data', (chunk) => {
        uploadedBytes += chunk.length
        const progress = ((uploadedBytes / fileInfo.size) * 100).toFixed(2)
        const elapsedTime = (Date.now() - startTime) / 1000 // 秒
        const uploadSpeed = (uploadedBytes / (1024 * 1024) / elapsedTime).toFixed(2) // MB/s

        console.log(
          `上传进度: ${progress}% | 已上传: ${formatBytes(uploadedBytes)} / ${formatBytes(fileInfo.size)} | 速度: ${uploadSpeed} MB/s`
        )
      })

      try {
        const resp = await formUploader.putStream(res.upToken, fileName, file, putExtra)
        if (resp.ok()) {
          const token = resp.data.token
          const maxRetry = 60
          for (let index = 0; index < maxRetry; index++) {
            try {
              const result = await this.getQiniupResults(token)
              if (!result.list) {
                continue
              }
              if (result.list[0].status === 1) {
                console.log('文件处理成功')
                return result.list[0].fileId
              }
              delay(1000)
            } catch {}
          }
        }
      } catch (e) {
        console.error(e)
      }
      throw new Error('uploadFile faile!')
    }
  }

  userInfo(): Promise<{
    accountMap: {
      userId: number
      totalSize: number
      usedSize: number
    }
  }> {
    return this.client.get(`${this.config.protectURL}/user/info/map`).json()
  }

  async downloadFile(fileId: string) {
    const { accountMap } = await this.userInfo()
    const nowTs = new Date().getTime().toString()
    const tsEncode = encrypt2Hex(nowTs, this.config.secret)
    const fidEncode = encrypt2Hex(`${fileId}|${accountMap.userId}`, this.config.secret)
    const auth = encrypt2Hex(`${fileId}|${nowTs}`, this.config.secret)
    const token = await this.getAppToken()
    const urlObject = new URLSearchParams({
      uuid: this.config.uuid as string,
      devType: this.config.devType as string,
      devCode: this.config.uuid as string,
      devModel: this.config.devModel as string,
      devVersion: this.config.devVersion as string,
      appVersion: '',
      timestamp: tsEncode,
      appToken: token,
      enable: '1',
      downloadId: fidEncode,
      auth
    })
    const url = `${this.config.apiUrl}/${this.config.publicURL}/file/redirect?${urlObject.toString()}`
    const downloadUrl = await got.get(url, {
      followRedirect: false
    })
    return downloadUrl.headers.location
  }
}

export class LanZouYClient extends ALanZouYClient {
  constructor(options: LanZouYClientOptions) {
    super(
      {
        secret: 'lanZouY-disk-app',
        webUrl: 'https://www.ilanzou.com',
        apiUrl: 'https://api.ilanzou.com',
        protectURL: 'proved',
        publicURL: 'unproved'
      },
      options
    )
  }
}

export class FeiJiPanClient extends ALanZouYClient {
  constructor(options: LanZouYClientOptions) {
    super(
      {
        secret: 'dingHao-disk-app',
        webUrl: 'https://www.feijipan.com',
        apiUrl: 'https://api.feijipan.com',
        protectURL: 'app',
        publicURL: 'ws'
      },
      options
    )
  }
}
