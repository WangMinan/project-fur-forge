export function usePublicSeo(page: string) {
  const { t, isEnglish } = usePublicI18n()
  const brand = computed(() => isEnglish.value ? 'DITE DOG' : '有点小狗工作室')
  const title = computed(() => page === 'home' ? `${brand.value} · ${isEnglish.value ? 'Fursuit Gallery' : '兽装作品主页'}` : `${t(`ui.${page}`)} · ${brand.value}`)
  const description = computed(() => t(`seo.${page}`))
  useSeoMeta({ title, description, ogTitle: title, ogDescription: description })
  return { pageTitle: title, pageDescription: description }
}

export function usePublicCatalogSeo(list: Ref<{ page: number, pageCount: number } | null | undefined>) {
  const route = useRoute()
  const origin = useRequestURL().origin
  const canonical = computed(() => new URL(publicPageHref(route.path, {}, (
    list.value && list.value.page <= list.value.pageCount ? list.value.page : 1
  )), origin).href)
  useHead(() => ({ link: [{ rel: 'canonical', href: canonical.value }] }))
  useSeoMeta({
    robots: computed(() => publicSearchFromQuery(route.query.q).active
      || !publicSearchFromQuery(route.query.q).valid
      || (list.value && list.value.page > Math.max(1, list.value.pageCount))
      ? 'noindex, follow' : 'index, follow'),
    ogUrl: canonical,
  })
}
