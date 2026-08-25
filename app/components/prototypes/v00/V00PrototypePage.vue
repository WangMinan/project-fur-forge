<script setup lang="ts">
import { publicHomeAggregateResponseSchema } from '~~/shared/schemas/public-content'
import FeaturedAEditorialOffset from './featured-a-editorial-offset/FeaturedAEditorialOffset.vue'
import FeaturedBTypeComposition from './featured-b-type-composition/FeaturedBTypeComposition.vue'
import FeaturedCMediaWindow from './featured-c-media-window/FeaturedCMediaWindow.vue'
import V00MotionCharacterShowcase from './motion-character/V00MotionCharacterShowcase.vue'
import V00SharedContinuity from './shared-continuity/V00SharedContinuity.vue'
import V00PrototypeNav from './V00PrototypeNav.vue'
import type {
  V00FeaturedContext,
  V00MotionCharacter,
  V00PrototypeView,
} from './types'

const route = useRoute()
const validViews = new Set<V00PrototypeView>([
  'a',
  'a-m2',
  'a-m3',
  'b',
  'b-m2',
  'b-m3',
  'c',
  'm1',
  'm2',
  'm3',
  'shared',
  'shared-detail',
])

const view = computed<V00PrototypeView>(() => {
  const candidate = String(route.params.view ?? 'b-m3') as V00PrototypeView
  return validViews.has(candidate) ? candidate : 'b-m3'
})

const { data: home, error } = await useFetch('/api/public/v1/home-aggregate', {
  key: 'v00-home-aggregate',
  headers: useRequestHeaders(['host']),
  transform: raw => publicHomeAggregateResponseSchema.parse(raw).data,
})

if (error.value) {
  throw createError({ statusCode: 500, statusMessage: 'V00 无法读取首页真实数据' })
}

const featuredWorks = computed(() => (
  home.value?.featured.available ? home.value.featured.items.slice(0, 3) : []
))

if (featuredWorks.value.length === 0) {
  throw createError({ statusCode: 503, statusMessage: 'V00 需要至少一项已发布代表作品' })
}

const preferredImages = computed(() => featuredWorks.value.map(work => (
  work.card.sources.webp.find(source => source.width >= 768)
  ?? work.card.sources.fallback.at(-1)!
)))

async function inlineImageForDev(source: string) {
  if (!import.meta.server || !source.startsWith('http')) return source
  try {
    const response = await fetch(source)
    if (!response.ok) return source
    const bytes = new Uint8Array(await response.arrayBuffer())
    let binary = ''
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
    }
    return `data:${response.headers.get('content-type') ?? 'image/webp'};base64,${btoa(binary)}`
  } catch {
    return source
  }
}

const inlineImageSrcs = useState<string[]>(
  'v00-inline-images-v2',
  () => preferredImages.value.map(image => image.src),
)
if (import.meta.server) {
  inlineImageSrcs.value = await Promise.all(
    preferredImages.value.map(image => inlineImageForDev(image.src)),
  )
}

const activeIndex = shallowRef(0)
function selectFeatured(index: number) {
  const count = featuredWorks.value.length
  if (count < 2) return
  activeIndex.value = (index + count) % count
}

const featuredItems = computed(() => featuredWorks.value.map((work, index) => ({
  work,
  imageSrc: inlineImageSrcs.value[index] ?? preferredImages.value[index]!.src,
  imageWidth: preferredImages.value[index]!.width,
  imageHeight: preferredImages.value[index]!.height,
})))

const context = computed<V00FeaturedContext>(() => ({
  items: featuredItems.value,
  activeIndex: activeIndex.value,
  work: featuredItems.value[activeIndex.value]!.work,
  imageSrc: featuredItems.value[activeIndex.value]!.imageSrc,
  imageWidth: featuredItems.value[activeIndex.value]!.imageWidth,
  imageHeight: featuredItems.value[activeIndex.value]!.imageHeight,
  eyebrow: 'SELECTED WORKS',
  title: '代表作品',
  description: '更多角色与制作细节，请前往完整作品展示。',
  ctaLabel: '浏览作品展示',
}))

const motionCharacter = computed<V00MotionCharacter>(() => (
  view.value === 'm2' || view.value === 'm3'
    ? view.value
    : view.value.endsWith('-m2')
      ? 'm2'
      : view.value.endsWith('-m3')
        ? 'm3'
        : 'm1'
))

const isLayoutA = computed(() => view.value === 'a' || view.value === 'a-m2' || view.value === 'a-m3')
const isLayoutB = computed(() => view.value === 'b' || view.value === 'b-m2' || view.value === 'b-m3')

function previousFeatured() {
  selectFeatured(activeIndex.value - 1)
}

function nextFeatured() {
  selectFeatured(activeIndex.value + 1)
}

useSeoMeta({
  title: computed(() => `V00 · ${view.value.toUpperCase()} · Visual Lab`),
})

useHead({
  meta: [
    { name: 'robots', content: 'noindex, nofollow, noarchive' },
    { name: 'googlebot', content: 'noindex, nofollow, noarchive' },
  ],
})
</script>

<template>
  <div class="v00-page" data-testid="v00-prototype" :data-v00-view="view">
    <V00PrototypeNav :current="view" />

    <FeaturedAEditorialOffset
      v-if="isLayoutA"
      :context="context"
      :motion="motionCharacter"
      @previous="previousFeatured"
      @next="nextFeatured"
    />
    <FeaturedBTypeComposition
      v-else-if="isLayoutB"
      :context="context"
      :motion="motionCharacter"
      @previous="previousFeatured"
      @next="nextFeatured"
    />
    <FeaturedCMediaWindow v-else-if="view === 'c'" :context="context" />
    <V00MotionCharacterShowcase
      v-else-if="view === 'm1' || view === 'm2' || view === 'm3'"
      :context="context"
      :character="motionCharacter"
    />
    <V00SharedContinuity
      v-else
      :context="context"
      :detail="view === 'shared-detail'"
    />
  </div>
</template>

<style scoped>
.v00-page {
  min-width: 0;
  overflow: clip;
  background: var(--public-bg-primary);
}
</style>
