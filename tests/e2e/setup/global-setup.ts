import {
  initializeAdmin,
  resetAdminPassword,
} from '../../../server/utils/auth'
import {
  E2E_ADMIN,
  E2E_DATABASE_FILE,
} from '../helpers/auth'
import {
  migrateFixtureDatabase,
  openFixtureDatabase,
} from '../helpers/fixture-db'

// E2E 认证夹具：webServer 使用固定测试库路径，globalSetup 在其启动后运行，
// 保证本次运行（含复用旧服务器的情况）都落到同一个已迁移、已知凭据的库。
export default async function globalSetup() {
  migrateFixtureDatabase(E2E_DATABASE_FILE)
  const sqlite = openFixtureDatabase(E2E_DATABASE_FILE)

  try {
    await initializeAdmin(sqlite, {
      username: E2E_ADMIN.username,
      password: E2E_ADMIN.password,
    })
    // 重置为固定密码，同时清除可能残留的失败计数、锁定与既有 Session 版本。
    await resetAdminPassword(sqlite, {
      username: E2E_ADMIN.username,
      newPassword: E2E_ADMIN.password,
    })
  }
  finally {
    sqlite.close()
  }
}
