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

function getParentPath(url: string): string {
  const dirname = path.dirname(url)
  return dirname
}

async function getResources(folderId?: number): Promise<Resource[] | undefined> {
  const res = await client.getFileList({
    folderId
  })
  return res.list?.map((file) => {
    return {
      id: String(file.fileId || file.folderId),
      href: `/${file.fileName || file.folderName}`,
      name: encodeURIComponent(file.fileName || file.folderName),
      size: file.fileSize * 1024 || 0,
      lastModified: file.updTime,
      creationDate: file.addTime,
      resourceType: file.fileType === 2 ? 'collection' : 'file'
    }
  })
}

export async function readdir(url: string) {
  console.log('url:', url)
  if (cacheResources.has(url)) {
    return cacheResources.get(url) || []
  }
  let resources: Resource[] | undefined = undefined
  if (url === '/') {
    resources = await getResources()
  } else {
    const parentPath = getParentPath(url)
    const list = await readdir(parentPath.endsWith('/') ? parentPath : `${parentPath}/`)
    if (list) {
      const name = path.basename(url).toUpperCase()
      const folder = list.find(
        (res) => res.name.toUpperCase() === name && res.resourceType === 'collection'
      )
      if (folder) {
        resources = await getResources(parseInt(folder.id))
      }
    }
  }
  if (resources !== undefined) {
    cacheResources.set(url, resources)
  }
  return resources || []
}
