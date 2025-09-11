export type ResourceType = 'collection' | 'file'

export type Resource = {
  id: string
  href: string
  name: string
  size: number
  lastModified: string
  creationDate: string
  resourceType: ResourceType
  available?: number
  used?: number
}
