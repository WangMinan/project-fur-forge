import { closeDatabase } from '../utils/database'

// Register after the mail worker: cancellation must settle its row before SQLite closes.
export default defineNitroPlugin((app) => {
  app.hooks.hook('close', closeDatabase)
})
