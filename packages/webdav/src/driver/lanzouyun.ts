import { LanZouYClient } from '@netdrive-sdk/ilanzou'
import { Resource } from '../types'
import { Cache } from '../cache'
import { Driver } from '../middleware/registerDriver'
export class LanZouYDriver extends Driver {
  private client: LanZouYClient

  constructor(config: { path: string }, client: LanZouYClient) {
    super(config)
    this.client = client
  }

  async getResources(folderId?: number): Promise<Resource[] | undefined> {
    const res = await this.client.getFileList({
      folderId
    })
    return res.list?.map((file) => {
      return {
        id: String(file.fileId || file.folderId),
        href: `/dav/${this.config.path.endsWith('/') ? this.config.path : `${this.config.path}/`}${file.fileName || file.folderName}`,
        name: encodeURIComponent(file.fileName || file.folderName),
        size: file.fileSize * 1024 || 0,
        lastModified: file.updTime,
        creationDate: file.addTime,
        resourceType: file.fileType === 2 ? 'collection' : 'file'
      }
    })
  }

  @Cache({ ttl: 60 * 1000 })
  async readdir(url: string) {
    let resources: Resource[] | undefined = undefined
    if (url === '/') {
      const root: Resource = await this.buildRootResource()
      resources = await this.getResources()
      resources?.unshift(root)
    } else {
      const folder = await this.urlToResource(url, 'collection')
      if (folder) {
        resources = await this.getResources(parseInt(folder.id))
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
    return (await this.client.ensureFolderPath(decodeURIComponent(url))) + ''
  }

  @Cache({ ttl: 10 * 60 * 1000 })
  async diskinfo() {
    const res = await this.client.userInfo()
    const { usedSize, totalSize } = res.map
    return { used: usedSize * 1024, available: (totalSize - usedSize) * 1024 }
  }
}
