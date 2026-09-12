import zh from './locales/zh-CN.json'
import en from './locales/en.json'

export default defineI18nConfig(() => ({
  legacy: false,
  fallbackLocale: 'zh-CN',
  messages: { 'zh-CN': zh, en },
}))
