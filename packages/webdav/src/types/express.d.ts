declare global {
  namespace Express {
    interface Response {
      propfind: (data: any[]) => void
      notFound: (url: string) => void
    }
  }
}

export {}
