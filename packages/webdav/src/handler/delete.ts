import { type Request, type Response } from 'express'
import { unlink } from '../driver/lanzouyun'

export default (req: Request, res: Response) => {
  console.log('delete:', req.path)
  unlink(req.path).then((resourceId) => {
    if (resourceId) {
      res.status(200)
      res.end()
    } else {
      res.notFound(req.path)
    }
  })
}
