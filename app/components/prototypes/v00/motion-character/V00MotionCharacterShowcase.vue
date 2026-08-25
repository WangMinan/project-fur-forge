<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted } from 'vue'
import PublicAction from '~/components/PublicAction.vue'
import type { V00FeaturedContext, V00MotionCharacter } from '../types'
import { v00MotionProfiles } from '../types'

const props = defineProps<{
  context: V00FeaturedContext
  character: V00MotionCharacter
}>()

const frame = shallowRef(0)
const status = shallowRef('Ready · static first frame')
const isReduced = shallowRef(false)
const isAnimating = shallowRef(false)
const activeAnimations = shallowRef<Animation[]>([])
const media = useTemplateRef<HTMLElement>('media')
const title = useTemplateRef<HTMLElement>('title')
const description = useTemplateRef<HTMLElement>('description')
const action = useTemplateRef<HTMLElement>('action')

const activeCharacter = computed(() => v00MotionProfiles[props.character])
const frameLabel = computed(() => String(frame.value + 1).padStart(2, '0'))
const imageStyle = computed(() => ({
  objectPosition: frame.value === 0 ? '50% 44%' : '52% 39%',
}))

function cancelAnimations(message = 'Interrupted · state remains readable') {
  for (const animation of activeAnimations.value) animation.cancel()
  activeAnimations.value = []
  isAnimating.value = false
  status.value = message
}

function animationFor(element: HTMLElement, distance: number, overshoot: number, duration: number, easing: string, startScale = 1, crossAxis = 0) {
  const sign = distance < 0 ? -1 : 1
  const settleScale = startScale < 1 ? 1.012 : 1
  const keyframes = overshoot === 0
    ? [
        { opacity: 0, transform: `translate3d(${distance}px, ${crossAxis}px, 0) scale(${startScale})` },
        { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' },
      ]
    : [
        { opacity: 0, transform: `translate3d(${distance}px, ${crossAxis}px, 0) scale(${startScale})` },
        { opacity: 1, offset: 0.72, transform: `translate3d(${sign * overshoot}px, ${crossAxis * -0.18}px, 0) scale(${settleScale})` },
        { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' },
      ]
  return element.animate(keyframes, {
    duration,
    easing,
    fill: 'both',
  })
}

async function showFrame(direction: 1 | -1) {
  cancelAnimations()
  const targetFrame = (frame.value + direction + 2) % 2
  frame.value = targetFrame
  status.value = direction === 1 ? 'Next · moving forward' : 'Previous · reversing direction'

  if (isReduced.value || typeof Element.prototype.animate !== 'function') {
    status.value = `${direction === 1 ? 'Next' : 'Previous'} · reduced / native fallback`
    return
  }

  await nextTick()
  const config = activeCharacter.value
  const nodes = [
    { element: media.value, ratio: 1 },
    { element: title.value, ratio: props.character === 'm3' ? 0.62 : 0.38 },
    { element: description.value, ratio: props.character === 'm3' ? 0.4 : 0.25 },
    { element: action.value, ratio: props.character === 'm3' ? 0.22 : 0.14 },
  ]
  const animations = nodes
    .filter((node): node is { element: HTMLElement; ratio: number } => Boolean(node.element))
    .map(node => animationFor(
      node.element,
      direction * config.distance * node.ratio,
      config.overshoot * node.ratio,
      config.duration,
      config.easing,
      config.scale,
      config.crossAxis,
    ))
  activeAnimations.value = animations
  isAnimating.value = true
  await Promise.allSettled(animations.map(animation => animation.finished))
  if (activeAnimations.value.every(animation => animations.includes(animation))) {
    activeAnimations.value = []
    isAnimating.value = false
    status.value = `${direction === 1 ? 'Next' : 'Previous'} · settled on frame ${frameLabel.value}`
  }
}

function interrupt() {
  cancelAnimations('Interrupted · current frame preserved')
}

function playArrival() {
  if (isReduced.value || !media.value || typeof Element.prototype.animate !== 'function') {
    status.value = 'Arrival · reduced / static'
    return
  }
  cancelAnimations()
  const animation = animationFor(media.value, activeCharacter.value.distance * 0.35, activeCharacter.value.overshoot * 0.35, activeCharacter.value.duration, activeCharacter.value.easing, activeCharacter.value.scale, activeCharacter.value.crossAxis * 0.35)
  activeAnimations.value = [animation]
  isAnimating.value = true
  animation.finished.then(() => {
    if (activeAnimations.value[0] !== animation) return
    activeAnimations.value = []
    isAnimating.value = false
    status.value = 'Arrival · settled'
  })
}

function updateReducedMotion() {
  isReduced.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

onMounted(() => {
  updateReducedMotion()
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', updateReducedMotion)
  requestAnimationFrame(playArrival)
})

onBeforeUnmount(() => {
  cancelAnimations()
  window.matchMedia('(prefers-reduced-motion: reduce)').removeEventListener('change', updateReducedMotion)
})
</script>

<template>
  <section
    class="v00-motion"
    :class="[`v00-motion--${character}`, { 'v00-motion--animating': isAnimating }]"
    :data-motion-character="character"
    aria-labelledby="v00-motion-title"
    data-variant="motion-showcase"
  >
    <div class="v00-motion__intro">
      <p class="v00-motion__eyebrow">MOTION CHARACTER SHOWCASE</p>
      <p class="v00-motion__variant">{{ activeCharacter.label }}</p>
      <h1 id="v00-motion-title" ref="title" class="v00-motion__title">{{ context.work.work.characterName }}</h1>
      <p class="v00-motion__summary">{{ activeCharacter.summary }}</p>
      <div class="v00-motion__switcher" role="list" aria-label="Motion character">
        <NuxtLink v-for="key in ['m1', 'm2', 'm3']" :key="key" :to="`/__prototype/v00/${key}`" :class="{ 'v00-motion__switch--active': character === key }" role="listitem">
          {{ key.toUpperCase() }}
        </NuxtLink>
      </div>
    </div>

    <div class="v00-motion__stage">
      <div ref="media" class="v00-motion__media" :data-frame="frameLabel">
        <img
          :style="imageStyle"
          :src="context.imageSrc"
          :alt="context.work.card.alt"
          :width="context.imageWidth"
          :height="context.imageHeight"
          loading="eager"
          fetchpriority="high"
        >
        <span class="v00-motion__frame" aria-hidden="true">{{ frameLabel }} / 02</span>
      </div>

      <div class="v00-motion__copy">
        <p class="v00-motion__species">{{ context.work.work.species }} · {{ frameLabel }} / 02</p>
        <p ref="description" class="v00-motion__description">{{ context.description }}</p>
        <span ref="action" class="v00-motion__action-wrap">
          <PublicAction to="/works" class="v00-motion__action">
            {{ context.ctaLabel }}
          </PublicAction>
        </span>
      </div>
    </div>

    <div class="v00-motion__controls" aria-label="Motion controls">
      <button type="button" data-v00-action="previous" @click="showFrame(-1)">Previous</button>
      <button type="button" data-v00-action="next" @click="showFrame(1)">Next</button>
      <button type="button" data-v00-action="interrupt" :disabled="!isAnimating" @click="interrupt">Interrupt</button>
      <span aria-live="polite">{{ status }}</span>
    </div>
  </section>
</template>

<style scoped>
.v00-motion {
  --motion-ink: #20242b;
  min-height: calc(100svh - var(--public-header-height) - 6.6rem);
  color: var(--motion-ink);
  background: #f2f1ed;
}

.v00-motion__intro,
.v00-motion__stage,
.v00-motion__controls {
  max-width: 90rem;
  margin: 0 auto;
  padding-inline: var(--public-page-padding);
}

.v00-motion__intro {
  display: grid;
  gap: 0.55rem;
  padding-top: 1.35rem;
}

.v00-motion__eyebrow,
.v00-motion__variant,
.v00-motion__species,
.v00-motion__frame,
.v00-motion__controls,
.v00-motion__switcher {
  font-family: var(--font-public-mono);
  font-size: 0.68rem;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}

.v00-motion__variant,
.v00-motion__species,
.v00-motion__frame {
  color: #666c75;
}

.v00-motion__title {
  margin-top: 0.4rem;
  font-family: var(--font-public-display);
  font-size: clamp(2.8rem, 12vw, 5rem);
  font-weight: 500;
  line-height: 0.94;
  letter-spacing: -0.05em;
}

.v00-motion__summary {
  max-width: 30rem;
  color: #555b63;
  line-height: 1.55;
}

.v00-motion__switcher {
  display: flex;
  gap: 1rem;
  margin-top: 0.55rem;
}

.v00-motion__switcher a {
  min-height: 2.75rem;
  padding-top: 0.7rem;
  color: #6a7078;
  border-bottom: 2px solid transparent;
}

.v00-motion__switcher a:hover,
.v00-motion__switch--active {
  color: var(--motion-ink) !important;
  border-bottom-color: currentcolor !important;
}

.v00-motion__stage {
  display: grid;
  gap: 1rem;
  align-items: end;
  padding-top: 1.35rem;
}

.v00-motion__media {
  position: relative;
  justify-self: start;
  width: min(72vw, 21rem);
  aspect-ratio: 3 / 4;
  overflow: hidden;
  background: #e5e4df;
}

.v00-motion--m2 .v00-motion__media {
  border-radius: 0.75rem;
  box-shadow: 14px 14px 0 #d9dce0;
}

.v00-motion--m2 .v00-motion__media::before {
  position: absolute;
  inset: 0;
  z-index: 2;
  border: 1px solid rgb(32 36 43 / 0.18);
  border-radius: inherit;
  content: '';
  pointer-events: none;
  transform: translate(10px, 10px) scale(0.97);
  transform-origin: center;
  transition: opacity 680ms var(--motion-ease-playful), transform 680ms var(--motion-ease-playful);
}

.v00-motion--m2.v00-motion--animating .v00-motion__media::before {
  opacity: 0.2;
  transform: translate(0, 0) scale(1);
}

.v00-motion--m1 .v00-motion__media {
  border: 1px solid rgb(32 36 43 / 0.16);
}

.v00-motion__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: object-position 260ms var(--motion-ease-standard);
}

.v00-motion__frame {
  position: absolute;
  right: 0.7rem;
  bottom: 0.65rem;
  padding: 0.25rem 0.4rem;
  color: #fff;
  background: rgb(32 36 43 / 0.74);
}

.v00-motion__copy {
  max-width: 22rem;
  padding-bottom: 0.35rem;
}

.v00-motion__description {
  margin-top: 0.75rem;
  color: #4e545d;
  line-height: 1.65;
}

.v00-motion__action {
  margin-top: 0.85rem;
}

.v00-motion__controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem 0.6rem;
  align-items: center;
  padding-top: 1.3rem;
  padding-bottom: 1rem;
}

.v00-motion__controls button {
  min-height: 2.75rem;
  padding: 0 0.8rem;
  color: var(--motion-ink);
  background: transparent;
  border: 1px solid #aeb3bb;
  border-radius: var(--radius-full);
  cursor: pointer;
}

.v00-motion__controls button:hover:not(:disabled),
.v00-motion__controls button:focus-visible {
  border-color: var(--motion-ink);
}

.v00-motion__controls button:disabled {
  cursor: default;
  opacity: 0.45;
}

.v00-motion__controls span {
  flex: 1 1 100%;
  color: #666c75;
  letter-spacing: 0;
  text-transform: none;
}

@media (min-width: 768px) {
  .v00-motion {
    min-height: calc(100svh - var(--public-header-height) - 3.75rem);
  }

  .v00-motion__intro {
    grid-template-columns: 1fr auto;
    align-items: end;
    padding-top: 1.5rem;
  }

  .v00-motion__title,
  .v00-motion__summary {
    grid-column: 1;
  }

  .v00-motion__switcher {
    grid-column: 2;
    grid-row: 1 / 4;
    align-self: start;
    margin-top: 0;
  }

  .v00-motion__stage {
    grid-template-columns: minmax(20rem, 1fr) minmax(18rem, 24rem);
    gap: clamp(2rem, 8vw, 8rem);
    padding-top: 2rem;
  }

  .v00-motion__media {
    width: min(100%, 28rem);
  }

  .v00-motion__copy {
    padding-bottom: 2.5rem;
  }

  .v00-motion__controls span {
    flex: 1 1 auto;
    margin-left: auto;
    text-align: right;
  }
}

@media (prefers-reduced-motion: reduce) {
  .v00-motion--m2 .v00-motion__media::before {
    opacity: 0;
    transition: none;
    transform: none;
  }

  .v00-motion__media img {
    transition: none;
  }
}
</style>
