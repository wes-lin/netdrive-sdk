import got, { Got } from 'got'
import { computedMD5, delay, encrypt2Hex } from '@netdrive-sdk/core'
import {
  LanZouYClientOptions,
  FileInfo,
  ApiResponse,
  PathResponse,
  QiniupFileInfo,
  ShareUrlResponse,
  QiniupUpTokenRequest,
  LanZouYClientConfig,
  FileListParam
} from './types'
import path from 'path'
import { logger } from './log'
import { uploadToQiniu } from './qiniuUploader'
import { MemoryTokenStore } from './store'

process.env.TZ = 'Asia/Hong_Kong'

abstract class ALanZouYClient {
  readonly username
  readonly password
  readonly tokenStore
  readonly config: LanZouYClientConfig
  readonly client: Got
  uuid?: string

  constructor(config: LanZouYClientConfig, options: LanZouYClientOptions) {
    this.username = options.username
    this.password = options.password
    this.tokenStore = options.tokenStore || new MemoryTokenStore()
    this.uuid = options.uuid
    this.config = {
      devModel: 'chrome',
      devVersion: '131',
      devType: '6',
      extra: '2',
      ...config
    }

    this.client = got.extend({
      prefixUrl: this.config.apiUrl,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.70 Safari/537.36',
        'Sec-Ch-Ua': `"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"`,
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': `"Windows"`,
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
        Origin: this.config.webUrl,
        Referer: `${this.config.webUrl}/`
      },
      retry: 2,
      hooks: {
        beforeRequest: [
          async (options) => {
            logger.debug(`beforeRequest url: ${options.url}`)
            const nowTs = new Date().getTime().toString()
            const tsEncode = encrypt2Hex(nowTs, this.config.secret)
            let uuid = ''
            if (!options.url.href.includes(`${this.config.publicURL}/getUuid`)) {
              uuid = await this.getUUid()
            }
            const searchParams = options.url.searchParams
            searchParams.append('uuid', uuid)
            searchParams.append('devType', this.config.devType as string)
            searchParams.append('devCode', uuid)
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
          async (response, retryWithMergedOptions) => {
            try {
              logger.debug(
                `afterResponse url: ${response.requestUrl}, response: ${response.body})}`
              )
              if (response.body) {
                const res = JSON.parse(response.body.toString())
                if (res.code === -2) {
                  this.tokenStore.set('')
                  return retryWithMergedOptions({})
                } else if (res.code === -1) {
                  await delay(1000)
                  return retryWithMergedOptions({}).then((res) => {
                    logger.debug(`Retry url: ${response.requestUrl} , response: ${res.body})}`)
                    return res
                  })
                }
              }
            } catch (e) {
              logger.error(e)
            }

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

  async getUUid() {
    if (!this.uuid) {
      const res = await this.client.get(`${this.config.publicURL}/getUuid`).json<{
        uuid: string
      }>()
      logger.info(`uuid:${res.uuid}`)
      this.uuid = res.uuid
    }
    return this.uuid
  }

  getFileList = (param?: FileListParam): Promise<FileInfo> => {
    const mergedParams = {
      folderId: 0,
      type: 0,
      offset: 1,
      limit: 60,
      ...param
    }
    return this.client
      .get(`${this.config.protectURL}/record/file/list`, {
        searchParams: mergedParams
      })
      .json()
  }

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

  move = (fileIds: string, folderIds: string, targetId: string): Promise<ApiResponse> =>
    this.client
      .post(`${this.config.protectURL}/file/folder/move`, {
        json: { fileIds, folderIds, targetId }
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

  async uploadFile(filePath: string, folderId = 0) {
    const fileName = path.basename(filePath)
    const fileInfo = await computedMD5(filePath)
    const fileSize = fileInfo.size > 1024 ? fileInfo.size / 1024 : 1
    const res = await this.getQiniupUpToken({
      fileName,
      fileSize,
      folderId,
      md5: fileInfo.md5
    })
    if (!res.upToken) {
      throw new Error(`cannot get upToken! ${JSON.stringify(res)}`)
    }
    if (res.upToken === '-1') {
      return res.map.fileId
    } else {
      try {
        logger.info(`准备上传文件: ${fileName}`)

        const { map } = await this.userInfo()
        const key = generateKey(map.account)
        function generateKey(account: string) {
          const now = new Date()
          return `storage/files/${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}/${account}/${now.getTime()}.gz`
        }
        const result = await uploadToQiniu(
          this.config.bucket,
          res.upToken,
          filePath,
          key,
          this.config.webUrl
        )

        logger.debug(`获取上传结果:${JSON.stringify(result)}`)
        const token = result.token
        if (!token) {
          throw new Error(`cannot get token! ${JSON.stringify(result)}`)
        }
        const maxRetry = 60 * 10
        for (let index = 0; index < maxRetry; index++) {
          try {
            const result = await this.getQiniupResults(token)
            if (!result.list) {
              continue
            }
            if (result.list[0].status === 1) {
              logger.info(`文件上传成功: ${fileName}`)
              return result.list[0].fileId
            }
            await delay(1000)
          } catch {}
        }
      } catch (e) {
        logger.error(e)
      }
      throw new Error('uploadFile faile!')
    }
  }

  userInfo(): Promise<{
    map: {
      userId: number
      account: string
      usedSize: number
      totalSize: number
    }
  }> {
    return this.client.get(`${this.config.protectURL}/user/account/map`).json()
  }

  async downloadFile(fileId: string, redirect?: boolean) {
    const { map } = await this.userInfo()
    const nowTs = new Date().getTime().toString()
    const tsEncode = encrypt2Hex(nowTs, this.config.secret)
    const fidEncode = encrypt2Hex(`${fileId}|${map.userId}`, this.config.secret)
    const auth = encrypt2Hex(`${fileId}|${nowTs}`, this.config.secret)
    const token = await this.getAppToken()
    const uuid = await this.getUUid()
    const urlObject = new URLSearchParams({
      uuid,
      devType: this.config.devType as string,
      devCode: uuid,
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
    if (redirect) {
      const downloadUrl = await got.get(url, {
        followRedirect: false
      })
      return downloadUrl.headers.location
    } else {
      return url
    }
  }

  async ensureFolderPath(folderPath: string, parentFolderId: number = 0): Promise<number> {
    if (!folderPath) {
      return 0
    }
    // 分割路径为各个部分
    const pathParts = folderPath.split('/').filter((part) => part.trim() !== '')

    let currentFolderId = parentFolderId

    for (let i = 0; i < pathParts.length; i++) {
      const folderName = pathParts[i]

      // 检查当前文件夹下是否存在目标文件夹
      const fileList = await this.getFileList({
        folderId: currentFolderId,
        type: 2,
        limit: 1000 // 假设一个文件夹下不会超过1000个文件/文件夹
      })

      // 查找匹配的文件夹
      const existingFolder = fileList.list?.find((item) => item.folderName === folderName)
      if (existingFolder) {
        // 文件夹已存在，使用现有ID
        currentFolderId = existingFolder.folderId
      } else {
        // 文件夹不存在，创建新文件夹
        // 获取剩余路径部分作为pathList
        const pathList = pathParts.slice(i).join('/')
        const response = await this.createFolder(currentFolderId, undefined, undefined, [pathList])

        if (response && response.list?.length) {
          currentFolderId = response.list[0].id
          // 剩余路径已经通过pathList处理，可以跳出循环
          break
        } else {
          throw new Error(`Failed to create folder: ${folderName}`)
        }
      }
    }

    return currentFolderId
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
        publicURL: 'unproved',
        bucket: 'wpanstore-lanzou'
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
        publicURL: 'ws',
        bucket: 'wpanstore'
      },
      options
    )
  }
}
