import { FeiJiPanClient, FileTokenStore, LanZouYClient } from '../src'
import * as fs from 'node:fs'
import * as crypto from 'crypto'
import path from 'node:path'

const generateRandomFile = () => {
  const size = 50 * 1024 * 1024 // 1MB
  const randomData = crypto.randomBytes(size) // 生成随机数据
  const filePath = `.cache/${crypto.randomUUID()}.bin`
  const dirPath = path.dirname(filePath)
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
  // 将随机数据写入文件
  fs.writeFileSync(filePath, randomData)
  return filePath
}

;(async () => {
  const options = {
    username: process.env.LZ_USER_NAME as string,
    password: process.env.LZ_PASSWORD as string,
    tokenStore: new FileTokenStore(`.token/${process.env.TYPE}/${process.env.LZ_USER_NAME}.token`),
    logConfig: {
      fileOutput: true,
      isDebugEnabled: true
    }
  }

  const fileName = generateRandomFile()

  const client =
    process.env.TYPE === 'feijipan' ? new FeiJiPanClient(options) : new LanZouYClient(options)

  const res = await client.uploadFile(fileName, 0)
  console.log(res)
})()
