import Database from 'better-sqlite3'

const db = new Database('.data/dev.db', { readonly: true })
console.log('--- publication_operations ---')
console.log(JSON.stringify(db.prepare(`
  SELECT id, operation_type AS type, entity_id AS workId, requested_version AS reqVer,
         status, failure_stage AS stage, internal_error_code AS code,
         cleanup_object_keys_json AS cleanup
  FROM publication_operations ORDER BY started_at DESC LIMIT 5
`).all(), null, 2))
console.log('--- assets ---')
console.log(JSON.stringify(db.prepare(`
  SELECT id, role, status, width, height, byte_size AS bytes, mime_type AS mime,
         private_object_key AS key
  FROM assets
`).all(), null, 2))
console.log('--- asset_variants ---')
console.log(JSON.stringify(db.prepare(`
  SELECT id, asset_id AS assetId, storage_scope AS scope, status, usage, width, format,
         object_key AS key, internal_error_code AS err
  FROM asset_variants
`).all(), null, 2))
console.log('--- work_assets ---')
console.log(JSON.stringify(db.prepare('SELECT work_id AS w, asset_id AS a, role, is_primary AS p FROM work_assets').all()))
db.close()
