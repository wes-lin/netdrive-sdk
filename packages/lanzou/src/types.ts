import { Store } from '@netdrive-sdk/core'

interface Response {
  zt: number
  info: any
}

export interface LanZouClientOptions {
  username: string
  password: string
  cookieStore?: Store<string>
}
