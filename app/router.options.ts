import type { RouterConfig } from '@nuxt/schema'

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

export default {
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }
    if (to.hash) {
      return {
        el: to.hash,
        top: anchorOffset(to.hash),
      }
    }
    if (to.fullPath === from.fullPath) {
      return false
    }
    return { left: 0, top: 0 }
  },
} satisfies RouterConfig
