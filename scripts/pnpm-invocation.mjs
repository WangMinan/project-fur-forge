export function pnpmInvocation(args, entry = process.env.npm_execpath) {
  if (!entry) {
    throw new Error('Run through pnpm so npm_execpath is available.')
  }
  return /\.(?:c|m)?js$/iu.test(entry)
    ? { command: process.execPath, args: [entry, ...args] }
    : { command: entry, args }
}
