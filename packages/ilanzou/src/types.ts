import { LoggerOptions } from '@netdrive-sdk/log'

interface Response {
  code: number
  msg: string
}

export interface ApiResponse<T = any> extends Response {
  list?: T[]
}

export interface FileListParam {
  folderId?: number
  offset?: number
  type?: number
  limit?: number
}

export interface FileInfo
  extends ApiResponse<{
    addTime: string
    updTime: string
    fileType: number
    fileId: number
    fileSize: number
    fileName: string
    folderId: number
    folderName: string
  }> {
  total: number
}

export interface QiniupFileInfo
  extends ApiResponse<{
    status: number
    fileId: string
  }> {}

export interface ShareUrlResponse extends ApiResponse {
  shareUrl: String
}

export interface PathResponse
  extends ApiResponse<{
    id: number
    path: string
  }> {}

export interface LanZouYClientOptions {
  username: string
  password: string
  tokenStore?: TokenStore
  logConfig?: LoggerOptions
}

export interface LanZouYClientConfig {
  secret: string
  webUrl: string
  apiUrl: string
  protectURL: string
  publicURL: string
  bucket: string
  devModel?: string
  devVersion?: string
  devType?: string
  extra?: string
  uuid?: string
}

export interface QiniupUpTokenRequest {
  fileId?: number
  fileName: string
  fileSize: number
  folderId?: number
  md5: string
}

export abstract class TokenStore {
  abstract set(token: string): Promise<void> | void

  abstract get(): Promise<string> | string
}
