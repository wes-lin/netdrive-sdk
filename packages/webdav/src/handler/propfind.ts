import { type Request, type Response } from 'express'
import { readdir } from '../driver/cloud189'

export default (req: Request, res: Response) => {
  console.log('propfind:', req.path)
  const depth = req.header('depth') ?? '1'
  readdir(req.path).then((resources) => res.propfind(resources))
}
