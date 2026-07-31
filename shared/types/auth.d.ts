declare module '#auth-utils' {
  interface User {
    id: string
    username: string
    version: number
  }

  interface UserSession {
    csrfToken?: string
  }

  interface SecureSessionData {
    sessionVersion: number
    lastSeenAt: number
  }
}

export {}
