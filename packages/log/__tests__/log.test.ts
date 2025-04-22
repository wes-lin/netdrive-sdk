import { Logger } from '../src'

const log = new Logger()

const msg = {
  username: 'test',
  password: '123'
}
console.info(msg)
log.info(msg)
