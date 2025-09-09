import { type Request, type Response } from 'express'
import { readdir } from '../driver/lanzouyun'

export default (req: Request, res: Response) => {
  console.log('propfind:', req.path)
  const depth = req.header('depth') ?? '1'
  readdir(req.path).then((resources) => {
    if (resources != undefined) {
      console.log(resources)
      res.propfind(resources)
    } else {
      res.notFound(req.path)
    }
  })
}
