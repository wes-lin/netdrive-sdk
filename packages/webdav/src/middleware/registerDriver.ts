import path from 'path'
import { Router, type Request, type Response } from 'express'
import { Resource } from '../types'

export abstract class Driver {
  public config: { path: string }

  constructor(config: { path: string }) {
    this.config = config
  }

  getParentPath(url: string): string {
    const dirname = path.dirname(url)
    return dirname.endsWith('/') ? dirname : `${dirname}/`
  }

  async urlToResource(
    baseUrl: string,
    resourceType?: 'collection' | 'file'
  ): Promise<Resource | undefined> {
    const parentPath = this.getParentPath(baseUrl)
    const list = await this.readdir(parentPath)
    if (list) {
      const name = path.basename(baseUrl).toUpperCase()
      const resource = list.find(
        (res) =>
          res.name.toUpperCase() === name &&
          (resourceType === undefined || res.resourceType === resourceType)
      )
      return resource
    }
  }

  async buildRootResource(): Promise<Resource> {
    let quota
    try {
      quota = await this.diskinfo()
    } finally {
      return {
        id: this.config.path,
        href: `/dav/${this.config.path}`,
        name: this.config.path,
        size: 0,
        lastModified: '',
        creationDate: '',
        resourceType: 'collection',
        used: quota?.used,
        available: quota?.available
      }
    }
  }

  abstract readdir(url: string): Promise<Resource[] | undefined>
  abstract get(url: string): Promise<string | undefined>
  abstract mkdir(url: string): Promise<string>
  abstract unlink(url: string): Promise<string | undefined>
  abstract diskinfo(): Promise<{ used: number; available: number }>
}

export default (driver: Driver) => {
  const router: Router = Router()

  router.propfind('*', (req: Request, res: Response) => {
    console.log('propfind:', req.path)
    const depth = req.header('depth') ?? '1'
    driver.readdir(req.path).then((resources) => {
      if (resources != undefined) {
        res.propfind(resources)
      } else {
        res.notFound(req.path)
      }
    })
  })

  router.get('*', (req: Request, res: Response) => {
    console.log('get:', req.path)
    driver.get(req.path).then((url) => {
      if (url) {
        res.redirect(url)
      } else {
        res.notFound(req.path)
      }
    })
  })

  router.delete('*', (req: Request, res: Response) => {
    console.log('delete:', req.path)
    driver.unlink(req.path).then((resourceId) => {
      if (resourceId) {
        res.status(200)
        res.end()
      } else {
        res.notFound(req.path)
      }
    })
  })

  router.mkcol('*', (req: Request, res: Response) => {
    console.log('mkcol:', req.path)
    driver.mkdir(req.path).then((resourceId) => {
      if (resourceId) {
        res.status(201)
        res.end()
      } else {
        res.notFound(req.path)
      }
    })
  })

  const davRouter: Router = Router()
  davRouter.use(`/${driver.config.path}`, router)
  return davRouter
}
