import { Router, type Request, type Response } from 'express'
import { LanZouYDriver } from '../driver/lanzouyun'
import registerDriver from '../middleware/registerDriver'
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

const drivers = [new LanZouYDriver({ path: 'lz' }, new LanZouYClient(options))]

const router: Router = Router()

drivers.forEach((driver) => {
  const lzRouter: Router = registerDriver(driver)
  router.use(lzRouter)
})

router.propfind('/', (req: Request, res: Response) => {
  const rootResources = drivers.map((driver) => driver.buildRootResource())
  Promise.all(rootResources).then((resources) => {
    const used = resources.reduce((sum, item) => sum + (Number(item?.used) || 0), 0)
    const available = resources.reduce((sum, item) => sum + (Number(item?.available) || 0), 0)
    const root: Resource = {
      id: 'dav',
      href: `/dav`,
      name: 'dav',
      size: 0,
      lastModified: '',
      creationDate: '',
      resourceType: 'collection',
      used,
      available
    }
    resources.unshift(root)
    res.propfind(resources)
  })
})

export default router
