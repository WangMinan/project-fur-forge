<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { publicWorkDetailResponseSchema } from '~~/shared/schemas/public-content'
import { PROJECT_NAME } from '~~/shared/constants/project'
import { formatCnyMinorUnits } from '~/utils/format'

/**
 * T19 真实作品详情：SSR 消费 GET /api/public/v1/works/{slug}。
 * 只渲染公开 DTO；404/500 走 Nuxt 原生 HTML 错误页（error.vue）。
 * 响应式 slug：同组件实例内切换（继续浏览直达另一详情）时重新拉取。
 */
const route = useRoute()
const slug = computed(() => String(route.params.slug ?? ''))

// 不提供显式 key：Nuxt 4 中静态 key 会让重挂载的详情页复用旧 slug 的缓存
// （status === 'success' 时跳过 initialFetch）。自动 key 含 URL，slug 变化即
// 生成新 key 并重新拉取，组件复用与重挂载两种路径都覆盖。
const { data: detail, error } = await useFetch(
  () => `/api/public/v1/works/${slug.value}`,
  {
    headers: useRequestHeaders(['host']),
    transform: raw => publicWorkDetailResponseSchema.parse(raw).data,
  },
)

// useFetch 的错误可能是 FetchError（statusCode 为原型 getter，序列化后丢失）、
// H3Error 或普通对象，这里对三种表示做防御性提取。
function resolveErrorStatus(err: unknown): number {
  if (!err || typeof err !== 'object') {
    return 500
  }
  const record = err as Record<string, unknown>
  for (const key of ['statusCode', 'status'] as const) {
    if (typeof record[key] === 'number') {
      return record[key]
    }
  }
  const response = record.response as { status?: number } | undefined
  return typeof response?.status === 'number' ? response.status : 500
}

function toPageError(err: unknown) {
  const statusCode = resolveErrorStatus(err) === 404 ? 404 : 500
  return createError({
    statusCode,
    statusMessage: statusCode === 404 ? '作品不存在或尚未发布' : '作品暂时无法打开',
    fatal: true,
  })
}

// 首次直达（SSR）：API 404/500 立即抛出 fatal 错误，由 HTML 错误页处理；
// 客户端同组件内切换 slug 失败时由下方 watch 经 showError 进入同一错误页。
if (error.value) {
  throw toPageError(error.value)
}

watch(error, (err) => {
  if (err) {
    showError(toPageError(err))
  }
})

const dto = computed(() => detail.value?.work)
const isAdoptionArchive = computed(() => Boolean(
  detail.value?.adoption
  || detail.value?.media.adoptionCover
  || detail.value?.media.designSheet,
))
const adoptionPrice = computed(() => {
  const price = detail.value?.adoption?.price
  return price ? formatCnyMinorUnits(price.minorUnits) : null
})
/**
 * 单一媒体区：出厂照 → 领养封面 → 设定图 合成同一个查看序列。
 * 成果图（出厂照、封面）在前，参考图（设定图）在后。三类图片共用左大图 +
 * 右缩略图布局，主图位置因此只有一处，不会在限宽居中与靠左之间跳动。
 * 只有单张时缩略图行按长度自动隐藏。
 */
const gallery = computed(() => {
  const media = detail.value?.media
  if (!media) {
    return []
  }
  const extras = [media.adoptionCover, media.designSheet].filter(Boolean)
  return [
    ...media.gallery,
    ...extras.map((item, index) => ({
      assetId: item!.assetId,
      alt: item!.alt,
      position: media.gallery.length + index,
      sources: item!.sources,
    })),
  ]
})
const initialGalleryAssetId = computed(() => {
  const media = detail.value?.media
  if (!media) return undefined
  return route.query.from === 'adoptions'
    ? media.designSheet?.assetId ?? media.adoptionCover?.assetId
    : media.card.assetId
})

useSeoMeta({
  title: computed(() => (dto.value
    ? `${dto.value.characterName} · ${isAdoptionArchive.value ? '设定领养' : '作品展示'} · ${PROJECT_NAME}`
    : `作品展示 · ${PROJECT_NAME}`)),
  description: computed(() => (dto.value
    ? `${dto.value.characterName}：${dto.value.species}。有点小狗工作室${isAdoptionArchive.value ? '设定领养角色详情' : '兽装作品档案'}。`
    : '有点小狗工作室兽装作品档案。')),
  ogTitle: computed(() => (dto.value
    ? `${dto.value.characterName} · ${PROJECT_NAME}`
    : `作品展示 · ${PROJECT_NAME}`)),
  ogDescription: computed(() => (dto.value
    ? `${dto.value.species} · ${isAdoptionArchive.value ? '设定领养角色详情' : '兽装作品档案'}`
    : '有点小狗工作室兽装作品档案。')),
  ogType: 'article',
})

useHead(() => ({
  script: dto.value && detail.value
    ? [{
        key: 'work-json-ld',
        type: 'application/ld+json',
        textContent: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'CreativeWork',
          name: dto.value.characterName,
          description: dto.value.species,
          image: detail.value.media.card.sources.fallback.at(-1)?.src,
          creator: {
            '@type': 'Organization',
            name: PROJECT_NAME,
          },
        }),
      }]
    : [],
}))

/**
 * 返回目标跟着入口语义走：领养卡通过 URL 标记来源，因此 SSR、尚未水合和刷新
 * 都能得到正确结果；从领养目录进入时也可以直接从上一条 fullPath 判断。其余
 * （作品展示、首页代表作品、直达）回作品展示，不需要自己维护历史栈。
 *
 * SSR 拿不到 history，所以先按 URL 来源标记直出；挂载后再用真实上一页恢复
 * 领养目录的搜索/分页地址，避免水合不一致。
 */
interface BackLink {
  href: RouteLocationRaw
  label: string
}

function workBack(href: RouteLocationRaw = '/works'): BackLink {
  return {
    href,
    label: '返回作品展示',
  }
}

function adoptionBack(href: RouteLocationRaw = '/adoptions'): BackLink {
  return {
    href,
    label: '返回设定领养',
  }
}

const back = shallowRef<BackLink>(
  route.query.from === 'adoptions'
    ? adoptionBack()
    : workBack(),
)

onMounted(() => {
  const previous = window.history.state?.back
  const fromAdoptions = route.query.from === 'adoptions'
  const adoptionPrevious = typeof previous === 'string'
    && /^\/adoptions(?:[/?#]|$)/u.test(previous)
  if (fromAdoptions || adoptionPrevious) {
    back.value = adoptionBack(adoptionPrevious ? previous : '/adoptions')
    return
  }
  const worksPrevious = typeof previous === 'string'
    && /^\/works(?:[?#]|$)/u.test(previous)
  if (worksPrevious) {
    back.value = workBack(previous)
  }
})
</script>

<template>
  <article
    v-if="dto"
    class="work-detail"
    :class="{ 'work-detail--adoption': isAdoptionArchive }"
    data-testid="work-detail"
    :data-detail-kind="isAdoptionArchive ? 'adoption' : 'work'"
    data-analytics-entity-type="work"
    :data-analytics-entity-id="dto.id"
    :data-work-slug="dto.slug"
  >
    <nav class="work-detail__back" aria-label="返回">
      <NuxtLink :to="back.href" class="work-detail__back-link">
        <span aria-hidden="true">←</span> {{ back.label }}
      </NuxtLink>
    </nav>

    <div class="work-detail__layout">
      <header class="work-detail__header">
        <h1 class="work-detail__name">
          {{ dto.characterName }}
        </h1>
        <dl class="work-detail__identity-ledger">
          <div>
            <dt>物种</dt>
            <dd>{{ dto.species }}</dd>
          </div>
          <div v-if="isAdoptionArchive">
            <dt>内容类型</dt>
            <dd>设定领养</dd>
          </div>
          <div v-if="detail?.adoption">
            <dt>领养价格</dt>
            <dd data-testid="adoption-detail-price">{{ adoptionPrice ?? '以详情为准' }}</dd>
          </div>
        </dl>
        <div v-if="isAdoptionArchive" class="work-detail__adoption-actions">
          <PublicAction to="/about#contact">
            联系咨询领养
          </PublicAction>
          <NuxtLink
            to="/adoptions"
            class="work-detail__archive-link"
          >
            浏览全部领养角色 <span aria-hidden="true">→</span>
          </NuxtLink>
        </div>
      </header>

      <div class="work-detail__media">
        <!--
          所有图片已并入同一查看序列，不再需要「出厂照 / 作品图集」这类分区标题。
          aria-label 保留，屏幕阅读器仍能识别这个区域。
        -->
        <section v-if="gallery.length > 0" class="work-detail__media-section" aria-label="作品图集">
          <WorkDetailGallery
            :gallery="gallery"
            :initial-asset-id="initialGalleryAssetId"
            :work-name="dto.characterName"
          />
        </section>
        <PublicEmptyState
          v-else
          title="作品图片正在整理中。"
          description="当前作品暂时没有可公开查看的图片。"
        />
      </div>
    </div>

  </article>
</template>

<style scoped>
.work-detail {
  padding-bottom: var(--space-6);
}

.work-detail__back {
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: var(--space-5) var(--public-page-padding) 0;
}

.work-detail__back-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 2.75rem;
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
}

.work-detail__back-link:hover {
  color: var(--public-accent-primary);
}

.work-detail__header {
  display: grid;
  grid-area: copy;
  align-content: start;
  justify-items: start;
  gap: var(--space-3);
  min-width: 0;
}

.work-detail__name {
  max-width: 100%;
  font-family: var(--font-role-display);
  font-size: var(--font-size-xl);
  font-weight: var(--type-display-weight);
  line-height: var(--type-display-line-height);
  letter-spacing: var(--type-display-letter-spacing);
  overflow-wrap: anywhere;
}

.work-detail__identity-ledger {
  display: grid;
  width: 100%;
  margin: var(--space-2) 0 0;
  border-top: 1px solid var(--public-border-primary);
}

.work-detail__identity-ledger div {
  display: grid;
  grid-template-columns: minmax(5rem, 0.75fr) minmax(0, 1fr);
  gap: var(--space-3);
  padding: var(--space-3) 0;
}

.work-detail__identity-ledger div + div {
  border-top: 1px solid var(--public-border-primary);
}

.work-detail__identity-ledger dt {
  color: var(--public-text-secondary);
  font-family: var(--font-role-metadata);
  font-size: var(--type-metadata-size);
  font-weight: var(--type-metadata-weight);
  line-height: var(--type-metadata-line-height);
}

.work-detail__identity-ledger dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
}

.work-detail__archive-link {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  width: 100%;
  min-height: 2.75rem;
  color: var(--public-text-primary);
  font-weight: 600;
}

.work-detail__adoption-actions {
  display: grid;
  gap: var(--space-2);
  width: 100%;
  margin-top: var(--space-2);
}

.work-detail__adoption-actions :deep(.public-action) {
  justify-content: center;
  width: 100%;
}

.work-detail__archive-link:hover {
  color: var(--public-accent-hover);
}

.work-detail__layout {
  display: grid;
  grid-template-areas:
    'copy'
    'media';
  gap: clamp(2rem, 6vw, 6rem);
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: var(--space-2) var(--public-page-padding) 0;
}

.work-detail__media {
  display: grid;
  grid-area: media;
  gap: var(--space-8);
  min-width: 0;
  align-content: start;
  min-height: 0;
}

.work-detail__media-section {
  min-width: 0;
}

@media (min-width: 1024px) {
  .work-detail__layout {
    grid-template-areas: 'media copy';
    grid-template-columns: minmax(0, 1fr) minmax(17rem, 23rem);
    align-items: start;
  }

  .work-detail__header {
    position: sticky;
    top: calc(var(--public-header-height) + var(--space-6));
    padding-top: var(--space-3);
  }
}

</style>
