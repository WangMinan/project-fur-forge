<script setup lang="ts">
import {
  CONTACT_PLATFORM_ACTION_LABELS,
  CONTACT_PLATFORM_LABELS,
  CONTACT_PLATFORM_LOGO_PATHS,
} from '~~/shared/constants/contact'
import type { PublicOfficialChannel } from '~~/shared/types/contracts'

const props = defineProps<{
  channels: PublicOfficialChannel[]
  email: string
  emailSubject?: string | undefined
}>()

const displayChannels = computed(() => props.channels.map(channel => ({
  ...channel,
  actionLabel: CONTACT_PLATFORM_ACTION_LABELS[channel.platform],
  label: CONTACT_PLATFORM_LABELS[channel.platform],
  logoSrc: CONTACT_PLATFORM_LOGO_PATHS[channel.platform],
  qr: pickFallbackImg(channel.qrCodeSources),
  qrSrcset: buildSrcset(channel.qrCodeSources.fallback),
})))
</script>

<template>
  <dl class="contact-list" data-testid="contact-channel-list">
    <div class="contact-list__row">
      <dt class="contact-list__label">邮箱</dt>
      <dd class="contact-list__value">
        <span class="contact-list__account">{{ email }}</span>
        <ContactEmailActions
          class="contact-list__actions"
          :email="email"
          :subject="emailSubject"
        />
      </dd>
    </div>

    <div
      v-for="channel in displayChannels"
      :key="channel.platform"
      class="contact-list__row"
      :data-linked="Boolean(channel.qrLinkUrl)"
      :data-platform="channel.platform"
    >
      <dt class="contact-list__label">{{ channel.label }}</dt>
      <dd class="contact-list__value">
        <span class="contact-list__account">{{ channel.account }}</span>
        <span class="contact-list__qr-anchor">
          <a
            v-if="channel.qrLinkUrl"
            class="contact-list__channel-action"
            :href="channel.qrLinkUrl"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="`${channel.actionLabel}：${channel.label} ${channel.account}`"
          >
            <span class="contact-list__qq-mark" aria-hidden="true">
              <img :src="channel.logoSrc" alt="" width="14" height="14">
            </span>
            {{ channel.actionLabel }}
          </a>
          <span v-else class="contact-list__channel-action contact-list__channel-action--disabled">
            <span class="contact-list__qq-mark" aria-hidden="true">
              <img :src="channel.logoSrc" alt="" width="14" height="14">
            </span>
            暂无直达链接
          </span>

          <span class="contact-list__qr" :aria-label="`${channel.label}二维码`" role="group">
            <img
              :src="channel.qr.src"
              :srcset="channel.qrSrcset"
              sizes="150px"
              :width="channel.qr.width"
              :height="channel.qr.height"
              :alt="`扫描${channel.label}官方二维码`"
              loading="lazy"
              decoding="async"
              referrerpolicy="no-referrer"
            >
            <span>扫码{{ channel.actionLabel }}</span>
          </span>
        </span>
      </dd>
    </div>
  </dl>
</template>

<style scoped>
.contact-list {
  margin: 0;
  border: 1px solid var(--public-border-secondary);
  border-radius: var(--radius-sm);
  background: var(--public-bg-primary);
}

.contact-list__row {
  display: grid;
  gap: var(--space-2) var(--space-4);
  padding: var(--space-4);
}

.contact-list__label {
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.contact-list__value {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3) var(--space-4);
  min-width: 0;
  margin: 0;
}

.contact-list__account {
  min-width: 0;
  font-size: var(--font-size-md);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.contact-list__actions,
.contact-list__qr-anchor {
  margin-inline-start: auto;
}

.contact-list__actions :deep(.public-action),
.contact-list__channel-action {
  min-width: 8.5rem;
  min-height: 2.75rem;
}

.contact-list__qr-anchor {
  position: relative;
  display: inline-flex;
}

.contact-list__channel-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: 0 var(--space-4);
  border: 1px solid var(--public-border-primary);
  border-radius: var(--radius-full);
  color: var(--public-text-primary);
  background: var(--public-bg-primary);
  font-size: var(--font-size-sm);
  font-weight: 600;
  line-height: 1;
  text-decoration: none;
  transition:
    border-color var(--motion-duration-state) var(--motion-ease-standard),
    color var(--motion-duration-state) var(--motion-ease-standard);
}

.contact-list__channel-action:hover {
  border-color: var(--public-accent-hover);
  color: var(--public-accent-hover);
}

.contact-list__channel-action:focus-visible {
  outline: 2px solid var(--public-focus-ring);
  outline-offset: 3px;
}

.contact-list__channel-action--disabled {
  color: var(--public-text-tertiary);
}

.contact-list__qq-mark {
  display: grid;
  width: 1.5rem;
  height: 1.5rem;
  place-items: center;
  border-radius: 50%;
  background: var(--public-accent-primary);
}

.contact-list__qq-mark img {
  width: 0.875rem;
  height: 0.875rem;
  filter: invert(1);
}

.contact-list__qr {
  display: inline-grid;
  justify-items: center;
  gap: var(--space-1);
  margin-top: var(--space-3);
  color: var(--public-text-tertiary);
  font-size: var(--font-size-xs);
}

.contact-list__qr img {
  width: 9.375rem;
  height: auto;
  border-radius: var(--radius-xs);
  background: var(--public-bg-primary);
}

/* 有直达按钮时，触控端不再常驻二维码；解码失败则保留扫码兜底。 */
.contact-list__row[data-linked='true'] .contact-list__qr {
  display: none;
}

@media (min-width: 768px) {
  .contact-list__row {
    grid-template-columns: 4.5rem minmax(0, 1fr);
    align-items: center;
  }
}

@media (hover: hover) and (pointer: fine) {
  .contact-list__row[data-linked='true'] .contact-list__qr {
    position: absolute;
    right: 0;
    bottom: calc(100% + var(--space-2));
    z-index: 4;
    display: inline-grid;
    width: max-content;
    margin: 0;
    padding: var(--space-2);
    border: 1px solid var(--public-border-secondary);
    border-radius: var(--radius-sm);
    background: var(--public-bg-primary);
    box-shadow: var(--shadow-card-hover);
    opacity: 0;
    transform: translateY(0.25rem);
    visibility: hidden;
    transition:
      opacity var(--motion-duration-state) var(--motion-ease-standard),
      transform var(--motion-duration-state) var(--motion-ease-standard),
      visibility var(--motion-duration-state);
  }

  .contact-list__qr-anchor:hover .contact-list__qr,
  .contact-list__qr-anchor:focus-within .contact-list__qr {
    opacity: 1;
    transform: translateY(0);
    visibility: visible;
  }
}

@media (prefers-reduced-motion: reduce) {
  .contact-list__channel-action,
  .contact-list__row[data-linked='true'] .contact-list__qr {
    transition: none;
  }
}
</style>
