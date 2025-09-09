import { type Request, type Response } from 'express'
import { get } from '../driver/lanzouyun'

export default (req: Request, res: Response) => {
  console.log('get:', req.path)
  get(req.path).then((url) => {
    if (url) {
      res.redirect(url)
    } else {
      res.notFound(req.path)
    }
  })
}
