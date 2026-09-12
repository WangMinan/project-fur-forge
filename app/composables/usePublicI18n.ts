import { SITE_LOCALES } from '~~/shared/constants/site-locales'
/** Shared public components also appear on the Chinese-only admin host. */
export function usePublicI18n() {
  const i18n = useI18n()
  const adminSite = useState('admin-site', () => Boolean(useRequestEvent()?.context.isAdminSite))
  const language = computed(() => adminSite.value ? 'zh-CN' : i18n.locale.value)
  const isEnglish = computed(() => language.value === 'en')
  const contactOnly = computed(() => SITE_LOCALES.find(item => item.code === language.value)?.commissionMode === 'contact')
  const t = (key: string, values: Record<string, string | number> = {}) => (
    i18n.t(key, values, { locale: language.value })
  )
  return { t, contactOnly, isEnglish, language, adminSite }
}
