import { expect, it } from 'vitest'
import { acceptedLanguageHeader } from '../../shared/utils/accepted-language'

it('filters rejected and malformed ranges without reordering accepted languages', () => {
  expect(acceptedLanguageHeader('en;q=0,zh-TW;q=0.8,en-US;q=1')).toBe('zh-TW;q=0.8,en-US;q=1')
  expect(acceptedLanguageHeader('en;q=0.000,zh;q=bogus,ja;q=2')).toBe('')
  expect(acceptedLanguageHeader('en-US,zh-CN;q=0.8')).toBe('en-US,zh-CN;q=0.8')
  expect(acceptedLanguageHeader(undefined)).toBe('')
})
