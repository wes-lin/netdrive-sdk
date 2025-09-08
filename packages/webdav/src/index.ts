import express, { type Express, type Request, type Response } from 'express'

import { propfindExtensions, notFoundExtensions } from './middleware/multiStatusXML'
import webdav from './router'

const app: Express = express()
const port = process.env.PORT ?? 8000

app.use(propfindExtensions)
app.use(notFoundExtensions)

app.get('/', (req: Request, res: Response) => {
  res.send('Express Server')
})

app.use('/webdav', webdav)

app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${port}`)
})
