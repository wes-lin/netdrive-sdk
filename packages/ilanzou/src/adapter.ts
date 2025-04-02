import { Adapter, CreateFolder, DeleteFile, ListFolder, Metadata } from '@netdrive-sdk/types'
import { LanZouYClient } from './client'

export class LanZouYAdapter extends Adapter {
  readonly client: LanZouYClient

  constructor(client: LanZouYClient) {
    super()
    this.client = client
  }

  async listFolder(): Promise<ListFolder> {
    const res = await this.client.getFileList()
    return {
      entries:
        res.list?.map(
          ({ fileType, fileId, fileName, folderId, folderName, fileSize, addTime, updTime }) => {
            return {
              tag: fileType === 1 ? 'file' : 'folder',
              id: fileType === 1 ? fileId : folderId,
              name: fileType === 1 ? fileName : folderName,
              size: fileType === 1 ? fileSize : undefined,
              createdWhen: addTime,
              updatedWhen: updTime
            }
          }
        ) || []
    }
  }

  async createFolder(parms: CreateFolder): Promise<Metadata> {
    const res = await this.client.createFolder(parms.parentFolderId, parms.folderName)
    if (!res.list) {
      throw new Error('CreateFolder fail')
    }
    const { id, path } = res.list[0]
    return {
      tag: 'folder',
      name: path,
      id
    }
  }

  async deleteFile(parms: DeleteFile) {
    await this.client.deleteFile(parms)
  }
}
