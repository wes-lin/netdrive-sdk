import got, { Got } from 'got'
import { LanZouClientOptions } from './types'
import { MemoryCookieStore } from './store'
import { logger } from './log'

export class LanZouClient {
  readonly username
  readonly password
  readonly cookieStore
  readonly client: Got

  constructor(options: LanZouClientOptions) {
    this.username = options.username
    this.password = options.password
    this.cookieStore = options.cookieStore || new MemoryCookieStore()
    this.client = got.extend({
      prefixUrl: 'https://pc.woozooo.com',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.70 Safari/537.36',
        'Sec-Ch-Ua': `"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"`,
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': `"Windows"`,
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site'
      },
      retry: 2,
      hooks: {
        beforeRequest: [
          async (options) => {
            logger.debug(`beforeRequest url: ${options.url}`)
            const cookie = await this.getCookie()
            options.headers['Cookie'] = cookie
          }
        ],
        afterResponse: [
          async (response, retryWithMergedOptions) => {
            try {
              logger.debug(
                `afterResponse url: ${response.requestUrl}, response: ${response.body})}`
              )
            } catch (e) {
              logger.error(e)
            }
            return response
          }
        ]
      }
    })
  }

  async login() {
    const res = await got.post('https://up.woozooo.com/mlogin.php', {
      form: {
        task: '3',
        uid: this.username,
        pwd: this.password
      }
    })
    const cookies =
      res.headers['set-cookie']?.map((cookie: string) => cookie.split(';')[0]).join('; ') || ''
    const body: {
      zt: number
      info: string
      id: number
    } = JSON.parse(res.body)
    return {
      data: body,
      cookie: cookies
    }
  }

  async getCookie() {
    const cookie = await this.cookieStore.get()
    if (cookie) {
      return cookie
    }
    const res = await this.login()
    logger.debug(`login response: ${JSON.stringify(res)}`)
    this.cookieStore.set(res.cookie)
    return res.cookie
  }

  getFileList(folderId: number) {
    return this.client
      .post('doupload.php', {
        form: {
          task: 47,
          folder_id: folderId
        }
      })
      .json()
  }
}
