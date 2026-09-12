import { acceptedLanguageHeader } from '~~/shared/utils/accepted-language'

export default defineNuxtPlugin({
  name: 'public-language',
  enforce: 'pre',
  dependsOn: ['i18n:plugin'],
  setup(nuxtApp) {
    const adminSite = useState('admin-site', () => Boolean(useRequestEvent()?.context.isAdminSite))
    useHead(() => ({ htmlAttrs: { lang: adminSite.value ? 'zh-CN' : unref(nuxtApp.$i18n.locale) } }))
  },
  hooks: {
    'i18n:beforeLocaleSwitch'(data) {
      if (!import.meta.server || !data.initialSetup) return
      const event = useRequestEvent()!
      const i18n = useNuxtApp().$i18n
      const saved = i18n.getLocaleCookie()
      if (saved === 'en' || saved === 'zh-CN') {
        data.newLocale = saved
        return
      }
      // The module matcher currently accepts q=0. Filter rejected/invalid ranges,
      // then let the module handle language variants, weights and ordering.
      const original = event.node.req.headers['accept-language']
      event.node.req.headers['accept-language'] = acceptedLanguageHeader(original)
      try { data.newLocale = i18n.getBrowserLocale() === 'en' ? 'en' : 'zh-CN' }
      finally { event.node.req.headers['accept-language'] = original }
    },
  },
})
