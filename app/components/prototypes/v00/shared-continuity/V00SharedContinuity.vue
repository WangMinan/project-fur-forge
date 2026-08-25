<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import PublicAction from '~/components/PublicAction.vue'
import type { V00FeaturedContext } from '../types'

interface V00ViewTransition {
  finished: Promise<void>
  skipTransition: () => void
}

type V00TransitionDocument = {
  startViewTransition?: (update: () => Promise<void> | void) => V00ViewTransition
}

const props = defineProps<{
  context: V00FeaturedContext
  detail: boolean
}>()

const route = useRoute()
const router = useRouter()
const status = shallowRef('Ready · local continuity prototype')
const reducedByPreference = shallowRef(false)
const activeTransition = shallowRef<V00ViewTransition | null>(null)

const mode = computed(() => {
  const candidate = String(route.query.mode ?? '')
  return candidate === 'fallback' || candidate === 'reduced' ? candidate : 'native'
})

const reduced = computed(() => mode.value === 'reduced' || reducedByPreference.value)
const destination = computed(() => mode.value === 'native'
  ? '/__prototype/v00/shared-detail'
  : `/__prototype/v00/shared-detail?mode=${mode.value}`)

function updateReducedMotion() {
  reducedByPreference.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function clearTransition() {
  activeTransition.value = null
}

async function navigateForward() {
  const documentWithTransition = document as unknown as V00TransitionDocument
  const supportsTransition = typeof documentWithTransition.startViewTransition === 'function'
  if (props.detail) {
    await router.push(mode.value === 'native' ? '/__prototype/v00/shared' : `/__prototype/v00/shared?mode=${mode.value}`)
    return
  }

  if (reduced.value || mode.value === 'fallback' || !supportsTransition) {
    status.value = reduced.value ? 'Reduced · direct navigation' : 'Fallback · direct navigation'
    await router.push(destination.value)
    return
  }

  status.value = 'Forward · shared media transition running'
  const transition = documentWithTransition.startViewTransition!(async () => {
    await router.push(destination.value)
  })
  activeTransition.value = transition
  transition.finished.then(() => {
    if (activeTransition.value === transition) {
      status.value = 'Forward · transition finished'
      clearTransition()
    }
  }).catch(() => clearTransition())
}

function interruptTransition() {
  if (activeTransition.value) {
    activeTransition.value.skipTransition()
    clearTransition()
    status.value = 'Interrupted · browser kept the navigated state'
    return
  }
  status.value = 'Interrupt · no active transition'
}

function beginInterruptedForward() {
  const documentWithTransition = document as unknown as V00TransitionDocument
  if (props.detail || reduced.value || typeof documentWithTransition.startViewTransition !== 'function') {
    status.value = 'Interrupt · native transition unavailable, direct navigation'
    void navigateForward()
    return
  }
  status.value = 'Interrupt · starting and immediately skipping transition'
  const transition = documentWithTransition.startViewTransition!(async () => {
    await router.push(destination.value)
  })
  activeTransition.value = transition
  window.setTimeout(() => {
    if (activeTransition.value === transition) interruptTransition()
  }, 36)
}

onMounted(() => {
  updateReducedMotion()
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', updateReducedMotion)
})

onBeforeUnmount(() => {
  window.matchMedia('(prefers-reduced-motion: reduce)').removeEventListener('change', updateReducedMotion)
})
</script>

<template>
  <section class="v00-shared" :class="{ 'v00-shared--detail': detail }" aria-labelledby="v00-shared-title" data-variant="shared-continuity">
    <div class="v00-shared__topline">
      <p>SHARED CONTINUITY / {{ detail ? 'DETAIL' : 'FEATURED' }}</p>
      <p>{{ mode.toUpperCase() }} · {{ reduced ? 'REDUCED' : 'MOTION READY' }}</p>
    </div>

    <div class="v00-shared__layout">
      <div class="v00-shared__media" style="view-transition-name: v00-shared-work">
        <img
          :src="context.imageSrc"
          :alt="context.work.card.alt"
          :width="context.imageWidth"
          :height="context.imageHeight"
          loading="eager"
          fetchpriority="high"
        >
      </div>

      <div class="v00-shared__content">
        <p class="v00-shared__eyebrow">{{ context.eyebrow }}</p>
        <h1 id="v00-shared-title" class="v00-shared__title">{{ context.work.work.characterName }}</h1>
        <p class="v00-shared__species">{{ context.work.work.species }}</p>
        <p class="v00-shared__description">{{ detail ? 'Work Detail destination · the media keeps one local identity.' : context.description }}</p>

        <div class="v00-shared__actions">
          <PublicAction v-if="!detail" type="button" data-v00-action="shared-forward" @click="navigateForward">
            Featured → Detail
          </PublicAction>
          <PublicAction v-else type="button" variant="secondary" data-v00-action="shared-back" @click="navigateForward">
            返回 Featured
          </PublicAction>
          <button v-if="!detail" type="button" class="v00-shared__interrupt" data-v00-action="shared-interrupt" @click="beginInterruptedForward">
            Interrupt test
          </button>
        </div>

        <nav class="v00-shared__modes" aria-label="Shared continuity modes">
          <NuxtLink :to="`/__prototype/v00/${detail ? 'shared-detail' : 'shared'}?mode=fallback`">Fallback</NuxtLink>
          <NuxtLink :to="`/__prototype/v00/${detail ? 'shared-detail' : 'shared'}?mode=reduced`">Reduced</NuxtLink>
          <NuxtLink :to="`/__prototype/v00/${detail ? 'shared-detail' : 'shared'}`">Native</NuxtLink>
        </nav>
        <p class="v00-shared__status" aria-live="polite">{{ status }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.v00-shared {
  min-height: calc(100svh - var(--public-header-height) - 6.6rem);
  color: #f4f2ed;
  background: #1b1f24;
}

.v00-shared__topline,
.v00-shared__layout {
  max-width: 90rem;
  margin: 0 auto;
  padding-inline: var(--public-page-padding);
}

.v00-shared__topline {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding-top: 1rem;
  padding-bottom: 0.55rem;
  color: #b7bdc5;
  border-bottom: 1px solid rgb(255 255 255 / 0.2);
  font-family: var(--font-public-mono);
  font-size: 0.65rem;
  letter-spacing: 0.1em;
}

.v00-shared__layout {
  display: grid;
  gap: 1.2rem;
  align-items: center;
  padding-top: 1.4rem;
  padding-bottom: 1.1rem;
}

.v00-shared__media {
  width: min(88vw, 21rem);
  aspect-ratio: 3 / 4;
  overflow: hidden;
  background: #2b3037;
  border-radius: 0.5rem;
}

.v00-shared__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.v00-shared__content {
  max-width: 26rem;
}

.v00-shared__eyebrow,
.v00-shared__status,
.v00-shared__modes {
  color: #adb4bd;
  font-family: var(--font-public-mono);
  font-size: 0.67rem;
  letter-spacing: 0.08em;
}

.v00-shared__title {
  margin-top: 0.65rem;
  font-family: var(--font-public-display);
  font-size: clamp(2.8rem, 12vw, 5.4rem);
  font-weight: 500;
  line-height: 0.95;
  letter-spacing: -0.05em;
}

.v00-shared__species {
  margin-top: 0.5rem;
  color: #c9cdd2;
}

.v00-shared__description {
  margin-top: 1rem;
  color: #d8dadd;
  line-height: 1.65;
}

.v00-shared__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  align-items: center;
  margin-top: 1.1rem;
}

.v00-shared__actions :deep(.public-action--primary) {
  --public-action-primary-text: #1b1f24;
  --public-action-primary-bg: #f4f2ed;
  --public-action-primary-border: #f4f2ed;
}

.v00-shared__interrupt {
  min-height: 2.75rem;
  padding: 0 0.85rem;
  color: #f4f2ed;
  background: transparent;
  border: 1px solid #68717d;
  border-radius: var(--radius-full);
  cursor: pointer;
}

.v00-shared__modes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
  margin-top: 1.1rem;
}

.v00-shared__modes a {
  min-height: 2.75rem;
  padding-top: 0.7rem;
  color: #bdc3cb;
  border-bottom: 1px solid transparent;
}

.v00-shared__modes a:hover,
.v00-shared__modes a:focus-visible {
  color: #fff;
  border-bottom-color: currentcolor;
}

.v00-shared__status {
  margin-top: 1rem;
  letter-spacing: 0;
  line-height: 1.5;
  text-transform: none;
}

@media (min-width: 768px) {
  .v00-shared {
    min-height: calc(100svh - var(--public-header-height) - 3.75rem);
  }

  .v00-shared__layout {
    grid-template-columns: minmax(20rem, 1fr) minmax(20rem, 0.8fr);
    gap: clamp(3rem, 9vw, 10rem);
    padding-top: 2rem;
  }

  .v00-shared__media {
    width: min(100%, 31rem);
  }

  .v00-shared__content {
    padding-bottom: 1.5rem;
  }
}

:global(::view-transition-group(v00-shared-work)) {
  animation-duration: 520ms;
  animation-timing-function: var(--motion-ease-standard);
}

@media (prefers-reduced-motion: reduce) {
  :global(::view-transition-group(v00-shared-work)) {
    animation-duration: 0.01ms;
  }
}
</style>
