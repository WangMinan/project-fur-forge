<script setup lang="ts">
import { publicReturnCharacterResponseSchema } from '~~/shared/schemas/return-photo'
import { PROJECT_NAME } from '~~/shared/constants/project'

/**
 * T35-F1 设定返图页：圆形主图 + 名称 + @昵称 + 该设定全部返图。
 *
 * 设定不存在、或还没有已发布返图时由服务端返回 404，这里转成标准错误页：
 * 公开端不暴露“存在一个空设定”这种后台事实。
 */
const route = useRoute()
const slug = computed(() => String(route.params.slug))

const { data, error } = await useFetch(
  () => `/api/public/v1/returns/${slug.value}`,
  {
    key: computed(() => `public-return-character-${slug.value}`),
    headers: useRequestHeaders(['host']),
    transform: raw => publicReturnCharacterResponseSchema.parse(raw).data,
  },
)

if (error.value || !data.value) {
  throw createError({ statusCode: 404, statusMessage: '找不到这个设定的返图' })
}

const character = computed(() => data.value!.character)
const photos = computed(() => data.value!.photos)
const work = computed(() => data.value!.work)
const primaryImage = computed(() => data.value!.primaryImage)

const title = computed(() => `${character.value.name}的返图 · ${PROJECT_NAME}`)
const description = computed(
  () => `${character.value.name}的真实穿着返图，共 ${photos.value.length} 张。`,
)

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
})

/** 主图头像只需要小尺寸，取最窄的 WebP 变体即可。 */
const avatarSrc = computed(() => (
  primaryImage.value?.sources.webp[0]?.src
  ?? primaryImage.value?.sources.fallback[0]?.src
  ?? null
))
</script>

<template>
  <div class="public-page">
    <div class="public-container character-page">
      <p class="character-page__back">
        <NuxtLink to="/returns">← 返图墙</NuxtLink>
      </p>

      <header class="character-page__header">
        <span class="character-page__avatar">
          <img
            v-if="avatarSrc"
            :src="avatarSrc"
            :alt="`${character.name}的返图主图`"
            loading="eager"
            decoding="async"
          >
        </span>
        <span class="character-page__identity">
          <h1 class="character-page__name">{{ character.name }}</h1>
          <p v-if="character.nickname" class="character-page__nickname">
            @{{ character.nickname }}
          </p>
          <p v-if="work" class="character-page__work">
            <NuxtLink :to="work.href">查看作品「{{ work.characterName }}」</NuxtLink>
          </p>
        </span>
      </header>

      <ReturnMasonry :items="photos" />
    </div>
  </div>
</template>

<style scoped>
.character-page {
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: var(--space-6) var(--public-page-padding) var(--space-7);
}

.character-page__back {
  font-size: var(--font-size-sm);
}

.character-page__back a {
  display: inline-flex;
  align-items: center;
  min-height: 2.75rem;
  color: var(--public-text-secondary);
}

.character-page__header {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  margin-bottom: var(--space-8);
}

.character-page__avatar {
  flex: none;
  display: grid;
  place-items: center;
  width: 5.5rem;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: var(--radius-full);
  background: var(--image-placeholder);
}

.character-page__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.character-page__identity {
  min-width: 0;
}

.character-page__name {
  font-family: var(--font-public-display);
  font-size: var(--font-size-xl);
  font-weight: 600;
  line-height: var(--line-height-heading);
  overflow-wrap: anywhere;
}

.character-page__nickname {
  margin-top: var(--space-1);
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
  overflow-wrap: anywhere;
}

.character-page__work {
  margin-top: var(--space-2);
  font-size: var(--font-size-sm);
}

.character-page__work a {
  color: var(--public-text-link);
}

@media (min-width: 768px) {
  .character-page__avatar {
    width: 7rem;
  }
}
</style>
