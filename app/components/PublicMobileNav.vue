<script setup lang="ts">
const props = defineProps<{
  open: boolean
  triggerId: string
}>()

const emit = defineEmits<{
  close: []
}>()

const route = useRoute()
const panelRef = ref<HTMLElement | null>(null)

function close() {
  emit('close')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
  }
}

watch(() => props.open, async (isOpen) => {
  if (!import.meta.client) {
    return
  }

  if (isOpen) {
    document.documentElement.style.overflow = 'hidden'
    await nextTick()
    const firstLink = panelRef.value?.querySelector<HTMLElement>('a, button')
    firstLink?.focus()
    document.addEventListener('keydown', onKeydown)
  }
  else {
    document.documentElement.style.overflow = ''
    document.removeEventListener('keydown', onKeydown)
    document.getElementById(props.triggerId)?.focus()
  }
})

watch(() => route.fullPath, () => {
  if (props.open) {
    close()
  }
})

onBeforeUnmount(() => {
  if (import.meta.client) {
    document.documentElement.style.overflow = ''
    document.removeEventListener('keydown', onKeydown)
  }
})
</script>

<template>
  <Transition name="mobile-nav">
    <div
      v-if="open"
      id="public-mobile-nav-panel"
      ref="panelRef"
      class="mobile-nav"
      role="dialog"
      aria-modal="true"
      aria-label="站点导航"
      data-testid="public-mobile-nav"
    >
      <div class="mobile-nav__bar">
        <span class="mobile-nav__brand">有点小狗工作室</span>
        <button
          type="button"
          class="mobile-nav__close"
          aria-label="关闭导航"
          @click="close"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M5 5l10 10M15 5L5 15"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>

      <nav class="mobile-nav__links" aria-label="主导航">
        <NuxtLink
          v-for="item in PUBLIC_NAV_ITEMS"
          :key="item.href"
          :to="item.href"
          class="mobile-nav__link"
          :class="{ 'mobile-nav__link--emphasized': item.emphasized }"
          :aria-current="route.path === item.href ? 'page' : undefined"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>
    </div>
  </Transition>
</template>

<style scoped>
.mobile-nav {
  position: fixed;
  z-index: 90;
  inset: 0;
  display: flex;
  flex-direction: column;
  padding: var(--space-4) var(--public-page-padding) var(--space-6);
  background: var(--public-bg-primary);
}

.mobile-nav__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 3rem;
}

.mobile-nav__brand {
  font-family: var(--font-public-display);
  font-size: var(--font-size-md);
}

.mobile-nav__close {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  color: var(--public-text-primary);
  background: none;
  border: none;
  border-radius: var(--radius-full);
  cursor: pointer;
  place-items: center;
}

.mobile-nav__close:hover {
  background: var(--public-bg-tertiary);
}

.mobile-nav__links {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-top: var(--space-6);
}

.mobile-nav__link {
  padding: var(--space-3) var(--space-2);
  color: var(--public-text-primary);
  font-family: var(--font-public-display);
  font-size: var(--font-size-lg);
  line-height: var(--line-height-heading);
  border-radius: var(--radius-sm);
}

.mobile-nav__link:hover {
  color: var(--public-accent-primary);
  background: var(--public-bg-secondary);
}

.mobile-nav__link[aria-current='page'] {
  color: var(--public-accent-primary);
}

.mobile-nav__link--emphasized {
  margin-top: var(--space-3);
  border-top: 1px solid var(--public-border-secondary);
  border-radius: 0;
}

.mobile-nav-enter-active,
.mobile-nav-leave-active {
  transition: opacity var(--duration-normal) var(--easing-standard);
}

.mobile-nav-enter-from,
.mobile-nav-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .mobile-nav-enter-active,
  .mobile-nav-leave-active {
    transition: none;
  }
}
</style>
