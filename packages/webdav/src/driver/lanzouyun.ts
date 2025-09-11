import path from 'path'
import { FileTokenStore, LanZouYClient, logger } from '@netdrive-sdk/ilanzou'
import { Resource } from '../types'
import { Cache } from '../cache'

logger.configure({
  fileOutput: true,
  isDebugEnabled: true
})
const tmpDir = '.temp'
const options = {
  username: process.env.LZ_USER_NAME as string,
  password: process.env.LZ_PASSWORD as string,
  tokenStore: new FileTokenStore(
    `${tmpDir}/token/${process.env.TYPE}/${process.env.LZ_USER_NAME}.token`
  ),
  uuid: crypto.randomUUID()
}

class LanZouYDriver {
  private client: LanZouYClient

  constructor(client: LanZouYClient) {
    this.client = client
  }

  getParentPath(url: string): string {
    const dirname = path.dirname(url)
    return dirname.endsWith('/') ? dirname : `${dirname}/`
  }

  async getResources(baseUrl: string, folderId?: number): Promise<Resource[] | undefined> {
    const res = await this.client.getFileList({
      folderId
    })
    return res.list?.map((file) => {
      return {
        id: String(file.fileId || file.folderId),
        href: `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}${file.fileName || file.folderName}`,
        name: encodeURIComponent(file.fileName || file.folderName),
        size: file.fileSize * 1024 || 0,
        lastModified: file.updTime,
        creationDate: file.addTime,
        resourceType: file.fileType === 2 ? 'collection' : 'file'
      }
    })
  }

  async urlToResource(
    baseUrl: string,
    resourceType?: 'collection' | 'file'
  ): Promise<Resource | undefined> {
    const parentPath = this.getParentPath(baseUrl)
    const list = await this.readdir(parentPath)
    if (list) {
      const name = path.basename(baseUrl).toUpperCase()
      const resource = list.find(
        (res) =>
          res.name.toUpperCase() === name &&
          (resourceType === undefined || res.resourceType === resourceType)
      )
      return resource
    }
  }

  @Cache({ ttl: 60 * 1000 })
  async readdir(url: string) {
    let resources: Resource[] | undefined = undefined
    if (url === '/') {
      const quota = await this.diskinfo()
      const root: Resource = {
        id: '0',
        href: '/',
        name: '/',
        size: 0,
        lastModified: '',
        creationDate: '',
        resourceType: 'collection',
        used: quota?.used,
        available: quota?.available
      }
      resources = await this.getResources(url)
      resources?.unshift(root)
    } else {
      const folder = await this.urlToResource(url, 'collection')
      if (folder) {
        resources = await this.getResources(url, parseInt(folder.id))
      }
    }
    return resources
  }

  @Cache({ ttl: 60 * 1000 })
  async get(url: string) {
    const file = await this.urlToResource(url, 'file')
    if (file) {
      const resourceUrl = await this.client.downloadFile(file.id)
      if (resourceUrl) {
        return resourceUrl
      }
    }
  }

  async unlink(url: string) {
    const resource = await this.urlToResource(url)
    if (resource) {
      if (resource.resourceType === 'file') {
        await this.client.deleteFile({
          fileIds: resource.id
        })
      } else {
        await this.client.deleteFile({
          folderIds: resource.id
        })
      }
      return resource.id
    }
  }

  async mkdir(url: string) {
    return await this.client.ensureFolderPath(decodeURIComponent(url))
  }

  @Cache({ ttl: 10 * 60 * 1000 })
  async diskinfo() {
    const res = await this.client.userInfo()
    const { usedSize, totalSize } = res.map
    return { used: usedSize * 1024, available: (totalSize - usedSize) * 1024 }
  }
}

const driver = new LanZouYDriver(new LanZouYClient(options))

export const readdir = (url: string) => driver.readdir(url)
export const get = (url: string) => driver.get(url)
export const unlink = (url: string) => driver.unlink(url)
export const mkdir = (url: string) => driver.mkdir(url)
