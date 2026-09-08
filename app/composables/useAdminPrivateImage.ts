import type { MaybeRefOrGetter } from 'vue'
import { isAdminMediaReadPath } from '~~/shared/constants/admin-media-preview'
import { adminMediaSignedUrlResponseSchema } from '~~/shared/schemas/admin-media-preview'
import type { AdminMediaSignedUrl } from '~~/shared/schemas/admin-media-preview'
import { AdminApiError } from './useAdminApi'

// Only in-flight requests are shared; signed URLs never enter SSR state or persistent storage.
const signing = new Map<string, Promise<AdminMediaSignedUrl>>()
const resumes = new Set<() => Promise<void>>()
let resumeTimer: ReturnType<typeof setTimeout> | undefined
let resuming = false

function canLoad() {
  return document.visibilityState !== 'hidden' && navigator.onLine
}

function scheduleResume() {
  if (!canLoad()) return
  clearTimeout(resumeTimer)
  resumeTimer = setTimeout(async () => {
    if (!canLoad() || resuming) return
    resuming = true
    try { await Promise.allSettled([...resumes].map(resume => resume())) }
    finally { resuming = false }
  }, 150)
}

function listen(add: boolean) {
  const action = add ? 'addEventListener' : 'removeEventListener'
  document[action]('visibilitychange', scheduleResume)
  for (const event of ['focus', 'pageshow', 'online']) window[action](event, scheduleResume)
}

export function useAdminPrivateImage(source: MaybeRefOrGetter<string | null | undefined>) {
  const { status, user, ensureSession } = useAdminAuth()
  const api = useAdminApi()
  const imageUrl = shallowRef<string>()
  const loading = shallowRef(false)
  const failed = shallowRef(false)
  let mounted = false
  let revision = 0
  let loaded = false
  let retried = false
  let expiresAt = 0

  function active() { return mounted && status.value === 'ready' && canLoad() }

  async function load() {
    const href = toValue(source)
    if (!href || !active() || loading.value) return
    const current = revision
    loading.value = true
    failed.value = false
    loaded = false
    if (href.startsWith('blob:')) {
      imageUrl.value = href
      expiresAt = Infinity
      return
    }
    try {
      const endpoint = new URL(href, location.origin)
      if (endpoint.origin !== location.origin || !isAdminMediaReadPath(endpoint.pathname)) {
        throw new Error('Private image source is invalid.')
      }
      endpoint.searchParams.set('delivery', 'url')
      const key = `${user.value?.id}:${endpoint.pathname}${endpoint.search}`
      let request = signing.get(key)
      if (!request) {
        request = api(`${endpoint.pathname}${endpoint.search}`, { schema: adminMediaSignedUrlResponseSchema, retry: 0 })
          .then(response => response.data)
          .finally(() => { if (signing.get(key) === request) signing.delete(key) })
        signing.set(key, request)
      }
      const signed = await request
      if (!mounted || current !== revision || status.value !== 'ready') return
      imageUrl.value = signed.url
      expiresAt = Date.parse(signed.expiresAt)
    }
    catch (error) {
      if (!mounted || current !== revision) return
      loading.value = false
      if (error instanceof AdminApiError && error.status === 401) {
        failed.value = true
        return
      }
      onError()
    }
  }

  function onLoad() {
    loaded = true
    loading.value = false
    failed.value = false
    retried = false
  }

  function onError() {
    loaded = false
    loading.value = false
    if (!retried && active() && !toValue(source)?.startsWith('blob:')) {
      retried = true
      imageUrl.value = undefined
      void load()
    }
    else { failed.value = true }
  }

  function retry() {
    revision++
    retried = false
    loading.value = false
    imageUrl.value = undefined
    void load()
  }

  async function resume() {
    // Passive checks must not extend the eight-hour idle session, including reconnect events.
    if (!active()) return
    await ensureSession({ revalidate: true, touch: false })
    if (active() && !loaded && (!loading.value || expiresAt <= Date.now())) retry()
  }

  function reset() {
    revision++
    imageUrl.value = undefined
    loading.value = false
    failed.value = false
    loaded = false
    retried = false
    expiresAt = 0
    if (status.value !== 'ready') signing.clear()
    if (mounted) void load()
  }

  watch([() => toValue(source), status], reset)
  onMounted(() => {
    mounted = true
    if (!resumes.size) listen(true)
    resumes.add(resume)
    reset()
  })
  onBeforeUnmount(() => {
    mounted = false
    revision++
    resumes.delete(resume)
    if (!resumes.size) {
      listen(false)
      clearTimeout(resumeTimer)
      signing.clear()
    }
  })
  return { imageUrl, loading, failed, onLoad, onError, retry }
}
