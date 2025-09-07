import path from 'path'
import { FileTokenStore, LanZouYClient, logger } from '@netdrive-sdk/ilanzou'
import { Resource } from '../types'

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
const client = new LanZouYClient(options)
const cacheResources = new Map<string, Resource[]>()
const cacheResourceUrl = new Map<string, string>()

function getParentPath(url: string): string {
  const dirname = path.dirname(url)
  return dirname.endsWith('/') ? dirname : `${dirname}/`
}

async function getResources(baseUrl: string, folderId?: number): Promise<Resource[] | undefined> {
  const res = await client.getFileList({
    folderId
  })
  return res.list?.map((file) => {
    return {
      id: String(file.fileId || file.folderId),
      href: `${baseUrl}${file.fileName || file.folderName}`,
      name: encodeURIComponent(file.fileName || file.folderName),
      size: file.fileSize * 1024 || 0,
      lastModified: file.updTime,
      creationDate: file.addTime,
      resourceType: file.fileType === 2 ? 'collection' : 'file'
    }
  })
}

export async function readdir(url: string) {
  if (cacheResources.has(url)) {
    return cacheResources.get(url) || []
  }
  let resources: Resource[] | undefined = undefined
  if (url === '/') {
    resources = await getResources(url)
  } else {
    const parentPath = getParentPath(url)
    const list = await readdir(parentPath)
    if (list) {
      const name = path.basename(url).toUpperCase()
      const folder = list.find(
        (res) => res.name.toUpperCase() === name && res.resourceType === 'collection'
      )
      if (folder) {
        resources = await getResources(url, parseInt(folder.id))
      }
    }
  }
  if (resources !== undefined) {
    cacheResources.set(url, resources)
  }
  return resources || []
}

export async function get(url: string) {
  if (cacheResourceUrl.has(url)) {
    return cacheResourceUrl.get(url)
  }
  const parentPath = getParentPath(url)
  const list = await readdir(parentPath)
  if (list) {
    const name = path.basename(url).toUpperCase()
    const file = list.find((res) => res.name.toUpperCase() === name && res.resourceType === 'file')
    if (file) {
      const resourceUrl = await client.downloadFile(file.id)
      if (resourceUrl) {
        cacheResourceUrl.set(url, resourceUrl)
        return resourceUrl
      }
    }
  }
}
