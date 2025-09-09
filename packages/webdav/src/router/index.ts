import { Router } from 'express'
import propfind from '../handler/propfind'
import get from '../handler/get'
import del from '../handler/delete'

const router: Router = Router()

router.propfind('*', propfind)
router.get('*', get)
router.delete('*', del)

export default router
