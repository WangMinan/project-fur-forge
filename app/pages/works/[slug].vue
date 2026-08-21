<script setup lang="ts">
import { publicWorkDetailResponseSchema } from '~~/shared/schemas/public-content'
import { PROJECT_NAME } from '~~/shared/constants/project'

/**
 * T19 真实作品详情：SSR 消费 GET /api/public/v1/works/{slug}。
 * 只渲染公开 DTO；404/500 走 Nuxt 原生 HTML 错误页（error.vue）。
 * 响应式 slug：同组件实例内切换（继续浏览直达另一详情）时重新拉取。
 */
const route = useRoute()
const slug = computed(() => String(route.params.slug ?? ''))
const sharedViewTransitionName = computed(() => (
  route.query.view === 'home-featured'
    ? 'home-featured-media'
    : route.query.view === 'home-adoption'
      ? 'home-adoption-media'
      : undefined
))

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

useSeoMeta({
  title: computed(() => (dto.value
    ? `${dto.value.characterName} · 作品展示 · ${PROJECT_NAME}`
    : `作品展示 · ${PROJECT_NAME}`)),
  description: computed(() => (dto.value
    ? `${dto.value.characterName}：${dto.value.species}。有点小狗工作室兽装作品档案。`
    : '有点小狗工作室兽装作品档案。')),
  ogTitle: computed(() => (dto.value
    ? `${dto.value.characterName} · ${PROJECT_NAME}`
    : `作品展示 · ${PROJECT_NAME}`)),
  ogDescription: computed(() => (dto.value
    ? `${dto.value.species} · 兽装作品档案`
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
 * （作品展示、首页精选、直达）回作品展示，不需要自己维护历史栈。
 *
 * SSR 拿不到 history，所以先按 URL 来源标记直出；挂载后再用真实上一页恢复
 * 领养目录的搜索/分页地址，避免水合不一致。
 */
const WORKS_BACK = { href: '/works', label: '返回作品展示' }
const ADOPTIONS_BACK = { href: '/adoptions', label: '返回设定领养' }
const back = ref(route.query.from === 'adoptions' ? ADOPTIONS_BACK : WORKS_BACK)

onMounted(() => {
  const previous = window.history.state?.back
  const fromAdoptions = route.query.from === 'adoptions'
  const adoptionPrevious = typeof previous === 'string'
    && /^\/adoptions(?:[/?#]|$)/u.test(previous)
  if (fromAdoptions || adoptionPrevious) {
    back.value = {
      href: adoptionPrevious ? previous : '/adoptions',
      label: '返回设定领养',
    }
  }
})
</script>

<template>
  <article
    v-if="dto"
    class="work-detail"
    data-testid="work-detail"
    data-analytics-entity-type="work"
    :data-analytics-entity-id="dto.id"
    :data-work-slug="dto.slug"
  >
    <nav class="work-detail__back" aria-label="返回">
      <NuxtLink :to="back.href" class="work-detail__back-link">
        <span aria-hidden="true">←</span> {{ back.label }}
      </NuxtLink>
    </nav>

    <header class="work-detail__header">
      <h1 class="work-detail__name">
        {{ dto.characterName }}
      </h1>
      <p class="work-detail__meta">
        {{ dto.species }}
      </p>
    </header>

    <div class="work-detail__layout">
      <div class="work-detail__media">
        <!--
          所有图片已并入同一查看序列，不再需要「出厂照 / 作品图集」这类分区标题。
          aria-label 保留，屏幕阅读器仍能识别这个区域。
        -->
        <section v-if="gallery.length > 0" class="work-detail__media-section" aria-label="作品图集">
          <WorkDetailGallery
            :gallery="gallery"
            :work-name="dto.characterName"
            :view-transition-name="sharedViewTransitionName"
          />
        </section>
      </div>
    </div>

  </article>
</template>

<style scoped>
/* 详情页自己提供收尾留白；页脚只留一段小间距。 */
.work-detail {
  padding-bottom: var(--space-7);
}

.work-detail__back {
  max-width: var(--public-content-article);
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
  max-width: var(--public-content-article);
  margin: 0 auto;
  padding: 0 var(--public-page-padding) var(--space-6);
}

.work-detail__name {
  font-family: var(--font-public-display);
  font-size: var(--font-size-xl);
  font-weight: 600;
  line-height: var(--line-height-heading);
  letter-spacing: var(--letter-spacing-tight);
}

.work-detail__meta {
  margin-top: var(--space-2);
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
}

.work-detail__layout {
  display: grid;
  gap: var(--space-6);
  max-width: var(--public-content-article);
  margin: 0 auto;
  padding: 0 var(--public-page-padding);
}

.work-detail__media {
  display: grid;
  gap: var(--space-8);
  min-width: 0;
  align-content: start;
}

.work-detail__media-section {
  min-width: 0;
}

.work-detail__media-title {
  margin: 0 0 var(--space-3);
  color: var(--public-text-tertiary);
  font-size: var(--font-size-sm);
  font-weight: 400;
  letter-spacing: var(--letter-spacing-label);
}

.work-detail__section-title {
  color: var(--public-text-tertiary);
  font-size: var(--font-size-sm);
  font-weight: 400;
  letter-spacing: var(--letter-spacing-label);
}

</style>
