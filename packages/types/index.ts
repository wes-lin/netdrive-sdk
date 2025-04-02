export interface Metadata {
  tag: 'file' | 'folder'
  name: string
  id: string | number
  size?: number
  createdWhen?: string
  updatedWhen?: string
}

export interface ListFolder {
  entries: Metadata[]
}

export interface CreateFolder {
  parentFolderId: string | number
  folderName: string
}

export interface DeleteFile {
  folderIds?: string | number[]
  fileIds?: string | number[]
}

export abstract class Adapter {
  abstract listFolder(): Promise<ListFolder>

  abstract createFolder(params: CreateFolder): Promise<Metadata>

  abstract deleteFile(params: DeleteFile): Promise<void>
}
