<script setup lang="ts">
import {
  CONTACT_PLATFORM_ACTION_LABELS,
  CONTACT_PLATFORM_LABELS,
  CONTACT_PLATFORM_LOGO_PATHS,
} from '~~/shared/constants/contact'
import type { PublicOfficialChannel } from '~~/shared/types/contracts'

const props = defineProps<{
  channels: PublicOfficialChannel[]
}>()

const displayChannels = computed(() => props.channels.map(channel => ({
  ...channel,
  label: CONTACT_PLATFORM_LABELS[channel.platform],
  actionLabel: CONTACT_PLATFORM_ACTION_LABELS[channel.platform],
  logoSrc: CONTACT_PLATFORM_LOGO_PATHS[channel.platform],
  // 链接来自保存二维码时解出的内容；解不出则回退为不可点击的纯展示。
  href: channel.qrLinkUrl,
  qr: pickFallbackImg(channel.qrCodeSources),
  qrSrcset: buildSrcset(channel.qrCodeSources.fallback),
})))
</script>

<template>
  <ul
    v-if="displayChannels.length > 0"
    class="contact-channel-grid"
    data-testid="contact-channel-grid"
    aria-label="官方平台联系方式"
  >
    <li
      v-for="channel in displayChannels"
      :key="channel.platform"
      class="contact-channel-grid__item"
      :data-platform="channel.platform"
      data-testid="contact-channel-card"
    >
      <!--
        有可用链接时整卡是一个链接：卡片本身就是行动，
        扫码与点击两种路径指向同一个渠道。无链接时回退为纯展示容器。
        不额外显示「添加好友」一类文字链接，可点击性由整卡 hover 表达，
        无障碍语义由 aria-label 承担。
      -->
      <component
        :is="channel.href ? 'a' : 'div'"
        class="contact-channel-grid__surface"
        :class="{ 'contact-channel-grid__surface--linked': Boolean(channel.href) }"
        :href="channel.href ?? undefined"
        :target="channel.href ? '_blank' : undefined"
        :rel="channel.href ? 'noopener noreferrer' : undefined"
        :aria-label="channel.href
          ? `${channel.actionLabel}：${channel.label} ${channel.account}`
          : undefined"
      >
        <div class="contact-channel-grid__heading">
          <img
            class="contact-channel-grid__logo"
            :src="channel.logoSrc"
            alt=""
            width="24"
            height="24"
            loading="lazy"
            decoding="async"
          >
          <h3 class="contact-channel-grid__name">{{ channel.label }}</h3>
        </div>

        <img
          class="contact-channel-grid__qr"
          :src="channel.qr.src"
          :srcset="channel.qrSrcset"
          sizes="(min-width: 1024px) 128px, (min-width: 768px) 180px, 150px"
          :width="channel.qr.width"
          :height="channel.qr.height"
          :alt="`扫描${channel.label}官方二维码`"
          loading="lazy"
          decoding="async"
          referrerpolicy="no-referrer"
        >

        <p
          class="contact-channel-grid__account"
          :aria-label="`${channel.label}：${channel.account}`"
        >
          {{ channel.account }}
        </p>
      </component>
    </li>
  </ul>
</template>

<style scoped>
.contact-channel-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

/* 列表项只负责占位；边框、背景和内边距都交给 __surface。 */
.contact-channel-grid__item {
  display: grid;
  min-width: 0;
}

/**
 * 视觉卡面就是这一层，因此 hover 抬升与阴影作用在整张卡上。
 * 边框/背景/内边距若留在外层 __item，浮起的只有内容区，
 * 阴影会落在边框内侧 —— 看起来像“只有卡片中心悬浮”。
 */
.contact-channel-grid__surface {
  display: grid;
  gap: var(--space-3);
  align-content: start;
  padding: var(--space-3);
  border: 1px solid var(--public-border-secondary);
  border-radius: var(--radius-sm);
  background: var(--public-bg-primary);
  color: inherit;
  text-decoration: none;
}

.contact-channel-grid__surface--linked {
  cursor: pointer;
  transition:
    transform var(--motion-duration-state) var(--motion-ease-standard),
    box-shadow var(--motion-duration-state) var(--motion-ease-standard);
}

@media (hover: hover) and (pointer: fine) {
  /* 与作品卡同一套 hover 观感，提示整张卡可点。 */
  .contact-channel-grid__surface--linked:hover {
    transform: translateY(-0.25rem) scale(1.02);
    box-shadow: var(--shadow-card-hover);
    border-color: var(--public-accent-decorative);
  }
}

@media (prefers-reduced-motion: reduce) {
  .contact-channel-grid__surface--linked {
    transition: none;
  }

  .contact-channel-grid__surface--linked:hover {
    transform: none;
  }
}

.contact-channel-grid__heading {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--space-2);
}

.contact-channel-grid__logo {
  width: 1.5rem;
  height: 1.5rem;
  flex: none;
  object-fit: contain;
}

.contact-channel-grid__name {
  min-width: 0;
  font-size: var(--font-size-sm);
  font-weight: 600;
  line-height: var(--line-height-heading);
  overflow-wrap: anywhere;
}

.contact-channel-grid__qr {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 1;
  border-radius: var(--radius-xs);
  background: var(--image-placeholder);
  object-fit: contain;
}

.contact-channel-grid__account {
  min-width: 0;
  color: var(--public-text-secondary);
  font-size: var(--font-size-base);
  line-height: var(--line-height-normal);
  text-align: center;
  overflow-wrap: anywhere;
}

@media (min-width: 768px) {
  .contact-channel-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-4);
  }

  .contact-channel-grid__item {
    padding: var(--space-4);
  }
}

@media (min-width: 1024px) {
  .contact-channel-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-4);
  }

  .contact-channel-grid__item {
    padding: var(--space-4);
  }
}
</style>
