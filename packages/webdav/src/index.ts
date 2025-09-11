import express, { type Express, type Request, type Response } from 'express'

import { webDaveExtensions } from './middleware/multiStatusXML'
import webdav from './router'

const app: Express = express()
const port = process.env.PORT ?? 8000

app.use(webDaveExtensions)

app.get('/', (req: Request, res: Response) => {
  res.send('Express Server')
})

app.use('/dav', webdav)

app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${port}`)
})
