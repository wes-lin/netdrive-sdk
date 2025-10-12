import { LanZouClient, FileCookieStore, logger } from '../src'

const tmpDir = '.temp'

;(async () => {
  logger.configure({
    logLevel: 'debug'
  })
  const options = {
    username: process.env.LZ_USER_NAME as string,
    password: process.env.LZ_PASSWORD as string,
    cookieStore: new FileCookieStore(`${tmpDir}/cookie/${process.env.LZ_USER_NAME}.cookie`)
  }

  const client = new LanZouClient(options)
  const res = await client.getFileList(-1)
  console.log(res)

  await client.createFolder(0, '测试文件夹', '文件夹描述')
})()
