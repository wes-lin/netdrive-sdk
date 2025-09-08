import { Router } from 'express'
import propfind from '../handler/propfind'
import get from '../handler/get'

const router: Router = Router()

router.propfind('*', propfind)
router.get('*', get)

export default router
