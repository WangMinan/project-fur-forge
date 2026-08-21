import type { RouterConfig } from '@nuxt/schema'
import type { RouterScrollBehavior } from 'vue-router'

type SavedPosition = NonNullable<Parameters<RouterScrollBehavior>[2]>

function anchorOffset(hash: string) {
  try {
    const target = document.querySelector(hash)
    return (Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0)
      + (target ? Number.parseFloat(getComputedStyle(target).scrollMarginTop) || 0 : 0)
  }
  catch {
    return 0
  }
}

function restoreAfterPageLoad(position: SavedPosition) {
  const nuxtApp = useNuxtApp()

  return new Promise<SavedPosition>((resolve) => {
    nuxtApp.hooks.hookOnce('page:loading:end', () => {
      requestAnimationFrame(() => resolve(position))
    })
  })
}

export default {
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return restoreAfterPageLoad(savedPosition)
    }
    if (to.hash) {
      return {
        el: to.hash,
        top: anchorOffset(to.hash),
      }
    }
    if (to.fullPath === from.fullPath) {
      return { left: 0, top: 0 }
    }
    return { left: 0, top: 0 }
  },
} satisfies RouterConfig
