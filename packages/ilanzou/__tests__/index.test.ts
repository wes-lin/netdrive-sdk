import { FeiJiPanClient, FileTokenStore, LanZouYClient } from '../src'
import * as fs from 'node:fs'
import * as crypto from 'crypto'
import path from 'node:path'

const generateRandomFile = () => {
  const size = 10 * 1024 * 1024 // 1MB
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
  const client = new FeiJiPanClient({
    username: process.env.LZ_USER_NAME as string,
    password: process.env.LZ_PASSWORD as string,
    tokenStore: new FileTokenStore(`.token/${process.env.LZ_USER_NAME}.token`),
    logConfig: {
      fileOutput: true,
      isDebugEnabled: true
    }
  })

  const fileName = generateRandomFile()

  // const fileName = '.cache/64cc168b-4e75-4eb9-a4eb-15c8475d5ca1.bin'

  const res = await client.uploadFile(fileName, 0)
  console.log(res)
})()
