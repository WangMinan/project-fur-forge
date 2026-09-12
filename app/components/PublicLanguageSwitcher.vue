<script setup lang="ts">
import { SITE_LOCALES } from '~~/shared/constants/site-locales'
const open = defineModel<boolean>({ default: false })
const { t, language } = usePublicI18n()
const { setLocale } = useI18n()
const blocked = useState('commission-language-blocked', () => false)
const changing = shallowRef(false)
const failed = shallowRef(false)
const ready = shallowRef(false)
const hovering = shallowRef(false)
const root = useTemplateRef<HTMLElement>('root')
const trigger = useTemplateRef<HTMLButtonElement>('trigger')

function close(restoreFocus = true) {
  open.value = false
  if (restoreFocus) trigger.value?.focus({ preventScroll: true })
}

function enter(event: PointerEvent) {
  if (!ready.value || event.pointerType !== 'mouse' || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
  hovering.value = true
  open.value = true
}

function leave(event: PointerEvent) {
  if (event.pointerType !== 'mouse' || !hovering.value) return
  hovering.value = false
  close(false)
}

function toggle(event: MouseEvent) {
  // Mouse hover keeps the menu open, as on About; touch and keyboard toggle it.
  open.value = hovering.value && event.detail > 0 ? true : !open.value
}

const route = useRoute()
watch(() => route.fullPath, () => close(false))

async function choose(value: 'zh-CN' | 'en') {
  if (blocked.value || changing.value) return
  failed.value = false
  changing.value = true
  try {
    await setLocale(value)
    close()
  }
  catch {
    failed.value = true
  }
  finally {
    changing.value = false
  }
}

function outside(event: PointerEvent) {
  if (open.value && event.target instanceof Node && !root.value?.contains(event.target)) close()
}
onMounted(() => {
  document.addEventListener('pointerdown', outside)
  ready.value = true
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside))
</script>

<template>
  <div ref="root" class="language-switcher" @pointerenter="enter" @pointerleave="leave" @keydown.esc.stop.prevent="close()">
    <button
      ref="trigger"
      class="language-switcher__trigger"
      type="button"
      :disabled="!ready"
      :aria-label="t('language.choose')"
      :aria-expanded="open"
      aria-controls="language-options"
      @click="toggle"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
        <path d="M3 5h12M9 2v3M5 5c0 6 6 9 8 10M13 5c0 6-6 9-10 10M14 21l4-11 4 11M15.5 17h5" />
      </svg>
    </button>
    <div v-if="open" class="language-switcher__dropdown">
      <div id="language-options" class="language-switcher__panel" :aria-busy="changing">
        <button
          v-for="option in SITE_LOCALES"
          :key="option.code"
          type="button"
          :lang="option.code"
          :aria-pressed="language === option.code"
          :disabled="blocked || changing"
          @click="choose(option.code)"
        >
          <span>{{ option.name }}</span>
        </button>
        <p v-if="blocked" role="status">{{ t('language.busy') }}</p>
        <p v-if="failed" role="alert">{{ t('language.failed') }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.language-switcher { position: relative; flex: none; }
.language-switcher__trigger { display: grid; place-items: center; width: 44px; height: 44px; border: 0; background: transparent; color: inherit; cursor: pointer; }
.language-switcher__dropdown { position: absolute; right: 0; top: 100%; width: var(--public-dropdown-width); max-width: calc(100vw - 2rem); padding-top: var(--space-2); }
.language-switcher__panel { padding: 0.5rem; border: 1px solid var(--public-border-secondary); border-radius: var(--radius-md); background: var(--public-bg-primary); color: var(--public-text-primary); box-shadow: 0 8px 24px rgb(0 0 0 / 12%); }
.language-switcher__panel button { display: flex; justify-content: flex-start; align-items: center; width: 100%; min-height: 44px; padding: var(--space-3) var(--space-4); border: 0; background: transparent; color: inherit; font: inherit; font-size: var(--font-size-sm); text-align: left; cursor: pointer; }
.language-switcher__panel button[aria-pressed='true'] { color: var(--public-accent-primary); }
.language-switcher__panel button:hover { background: var(--public-bg-secondary); }
.language-switcher__panel button:disabled { opacity: 0.6; cursor: wait; }
.language-switcher__panel p { padding: 0.5rem; font-size: var(--font-size-xs); }
</style>
