<script setup lang="ts">
import {
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
  logoSrc: CONTACT_PLATFORM_LOGO_PATHS[channel.platform],
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

      <p class="contact-channel-grid__account" :aria-label="`${channel.label}：${channel.account}`">
        {{ channel.account }}
      </p>
    </li>
  </ul>
</template>

<style scoped>
.contact-channel-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 9.5rem));
  justify-content: start;
  gap: var(--space-4);
  margin: 0;
  padding: 0;
  list-style: none;
}

.contact-channel-grid__item {
  display: grid;
  min-width: 0;
  gap: var(--space-3);
  align-content: start;
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
  border-radius: var(--radius-image);
  background: var(--public-bg-primary);
  object-fit: contain;
}

.contact-channel-grid__account {
  min-width: 0;
  color: var(--public-text-secondary);
  font-family: var(--font-public-mono);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
  text-align: left;
  overflow-wrap: anywhere;
}

@media (min-width: 768px) {
  .contact-channel-grid {
    grid-template-columns: repeat(auto-fit, 10.5rem);
    gap: var(--space-6);
  }
}
</style>
