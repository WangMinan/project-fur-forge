import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto'

const SCRYPT_COST = 131_072
const SCRYPT_BLOCK_SIZE = 8
const SCRYPT_PARALLELIZATION = 1
const SCRYPT_KEY_LENGTH = 64
const SCRYPT_MAX_MEMORY = 256 * 1024 * 1024
const PASSWORD_HASH_VERSION = 1
const PASSWORD_SALT_LENGTH = 16
const DUMMY_SALT = Buffer.from('fur-forge-dummy-login-salt')

export function validateNewPassword(password: string) {
  if (password.length < 12 || password.length > 256) {
    throw new Error('Password must contain 12 to 256 characters.')
  }
}

async function derive(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, SCRYPT_KEY_LENGTH, {
      N: SCRYPT_COST,
      r: SCRYPT_BLOCK_SIZE,
      p: SCRYPT_PARALLELIZATION,
      maxmem: SCRYPT_MAX_MEMORY,
    }, (error, derivedKey) => {
      if (error) {
        reject(error)
        return
      }
      resolve(derivedKey)
    })
  })
}

export async function hashAdminPassword(password: string) {
  validateNewPassword(password)
  const salt = randomBytes(PASSWORD_SALT_LENGTH)
  const digest = await derive(password, salt)

  return [
    'scrypt',
    `v=${PASSWORD_HASH_VERSION}`,
    `N=${SCRYPT_COST}`,
    `r=${SCRYPT_BLOCK_SIZE}`,
    `p=${SCRYPT_PARALLELIZATION}`,
    salt.toString('base64url'),
    digest.toString('base64url'),
  ].join('$')
}

export async function verifyAdminPassword(hash: string, password: string) {
  const [
    algorithm,
    version,
    cost,
    blockSize,
    parallelization,
    encodedSalt,
    encodedDigest,
  ] = hash.split('$')

  if (
    algorithm !== 'scrypt'
    || version !== `v=${PASSWORD_HASH_VERSION}`
    || cost !== `N=${SCRYPT_COST}`
    || blockSize !== `r=${SCRYPT_BLOCK_SIZE}`
    || parallelization !== `p=${SCRYPT_PARALLELIZATION}`
    || !encodedSalt
    || !encodedDigest
  ) {
    return false
  }

  const salt = Buffer.from(encodedSalt, 'base64url')
  const expected = Buffer.from(encodedDigest, 'base64url')
  if (
    salt.length !== PASSWORD_SALT_LENGTH
    || expected.length !== SCRYPT_KEY_LENGTH
  ) {
    return false
  }

  const actual = await derive(password, salt)
  return timingSafeEqual(expected, actual)
}

export async function burnPasswordCheck(password: string) {
  await derive(password, DUMMY_SALT)
}
