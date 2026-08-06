import type { AdminSession } from '../utils/route/auth-session'

declare module 'h3' {
  interface H3EventContext {
    adminSession?: AdminSession
  }
}

export {}
