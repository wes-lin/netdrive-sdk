import { type Request, type Response, type NextFunction } from 'express'
import { create } from 'xmlbuilder2'
import mimeTypes from 'mime-types'
import { Resource } from '../types'

function buildXML(resources: Resource[]) {
  const root = create({ version: '1.0', encoding: 'utf-8' }).ele('d:multistatus', {
    'xmlns:d': 'DAV:'
  })
  resources.forEach((resource) => {
    const response = root.ele('d:response')
    response.ele('d:href').txt(resource.href)
    const propstatSuccess = response.ele('d:propstat')
    const propSuccess = propstatSuccess.ele('d:prop')

    propSuccess.ele('d:displayname').txt(resource.name)
    propSuccess.ele('d:getcontenttype').txt(resource.resourceType)
    propSuccess.ele('d:getcreationdate').txt(resource.creationDate)
    propSuccess.ele('d:getlastmodified').txt(resource.lastModified)
    const resourcetypeElem = propSuccess.ele('d:resourcetype')
    const contentlength = propSuccess.ele('d:getcontentlength')
    const contenttype = propstatSuccess.ele('d:getcontenttype')
    if (resource.resourceType === 'collection') {
      contentlength.txt('0')
      contenttype.txt('httpd/unix-directory')
      resourcetypeElem.ele('d:collection')
    } else {
      contentlength.txt(resource.size.toString())
      contenttype.txt(mimeTypes.lookup(resource.name) || 'application/octet-stream')
      resourcetypeElem.ele('d:file')
    }
    propstatSuccess.ele('d:status').txt('HTTP/1.1 200 OK')
  })
  return root.end({ prettyPrint: true })
}

export const propfindExtensions = (req: Request, res: Response, next: NextFunction) => {
  res.propfind = (data: Resource[]) => {
    const xmlData = buildXML(data)
    res.status(207)
    res.set('Content-Type', 'application/xml; charset=utf-8')
    res.set('Content-Length', Buffer.from(xmlData, 'utf-8').byteLength.toString())
    res.send(xmlData)
  }
  next()
}
