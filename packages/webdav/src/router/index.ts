import { Router } from 'express'
import propfind from '../handler/propfind'
import get from '../handler/get'
import del from '../handler/delete'
import mkcol from '../handler/mkcol'

const router: Router = Router()

router.propfind('*', propfind)
router.get('*', get)
router.delete('*', del)
router.mkcol('*', mkcol)

export default router
