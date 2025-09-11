import { type Request, type Response } from 'express'
import { mkdir } from '../driver/lanzouyun'

export default (req: Request, res: Response) => {
  console.log('mkcol:', req.path)
  mkdir(req.path).then((resourceId) => {
    if (resourceId) {
      res.status(201)
      res.end()
    } else {
      res.notFound(req.path)
    }
  })
}
