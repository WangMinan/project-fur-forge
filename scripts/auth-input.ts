import { emitKeypressEvents } from 'node:readline'

interface TtyInput extends NodeJS.ReadableStream {
  isRaw?: boolean
  isTTY?: boolean
  readableFlowing?: boolean | null
  setRawMode: (mode: boolean) => unknown
}

interface TtyOutput extends NodeJS.WritableStream {
  isTTY?: boolean
}

function readTtyValue(
  prompt: string,
  hidden: boolean,
  input: TtyInput,
  output: TtyOutput,
) {
  if (!input.isTTY || !output.isTTY) {
    throw new Error(
      'Interactive credential input requires a TTY; controlled automation may set ADMIN_USERNAME and ADMIN_PASSWORD.',
    )
  }

  const wasRaw = input.isRaw ?? false
  const wasFlowing = input.readableFlowing
  let value = ''

  emitKeypressEvents(input)
  output.write(prompt)
  input.setRawMode(true)
  input.resume()

  return new Promise<string>((resolve, reject) => {
    const finish = (error?: Error) => {
      input.removeListener('keypress', onKeypress)
      input.setRawMode(wasRaw)
      if (wasFlowing !== true) {
        input.pause()
      }
      output.write('\n')

      if (error) {
        reject(error)
      }
      else {
        resolve(value)
      }
    }
    const onKeypress = (
      text: string | undefined,
      key: {
        ctrl?: boolean
        meta?: boolean
        name?: string
      },
    ) => {
      if (key.ctrl && key.name === 'c') {
        finish(new Error('Credential input cancelled.'))
        return
      }

      if (key.name === 'return' || key.name === 'enter') {
        finish()
        return
      }

      if (key.name === 'backspace') {
        if (value.length > 0) {
          value = Array.from(value).slice(0, -1).join('')
          if (!hidden) {
            output.write('\b \b')
          }
        }
        return
      }

      if (
        text
        && !key.ctrl
        && !key.meta
        && !key.name?.startsWith('arrow')
      ) {
        value += text
        if (!hidden) {
          output.write(text)
        }
      }
    }

    input.on('keypress', onKeypress)
  })
}

export async function readAdminCredentials(
  passwordPrompt: string,
  env: NodeJS.ProcessEnv = process.env,
  input = process.stdin as TtyInput,
  output = process.stdout as TtyOutput,
) {
  const username = env.ADMIN_USERNAME?.trim()
    || (await readTtyValue('Admin username: ', false, input, output)).trim()
  const password = env.ADMIN_PASSWORD
    || await readTtyValue(passwordPrompt, true, input, output)

  if (!username || !password) {
    throw new Error('Administrator username and password are required.')
  }

  return { password, username }
}
