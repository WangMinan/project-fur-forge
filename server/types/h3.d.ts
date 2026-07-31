import type { AdminSession } from '../utils/auth-session'

declare module 'h3' {
  interface H3EventContext {
    adminSession?: AdminSession
  }
}

export {}
