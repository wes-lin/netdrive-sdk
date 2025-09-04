declare global {
  namespace Express {
    export interface Response {
      propfind: (data: any[]) => void
    }
  }
}

export {}
