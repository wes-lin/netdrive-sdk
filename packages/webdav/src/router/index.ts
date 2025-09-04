import { Router, type Request, type Response } from 'express'
import propfind from '../handler/propfind'
const router = Router()

router.propfind('*', propfind)

export default router
