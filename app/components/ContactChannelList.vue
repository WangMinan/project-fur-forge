<script setup lang="ts">
import {
  CONTACT_PLATFORM_ACTION_LABELS,
  CONTACT_PLATFORM_LABELS,
  CONTACT_PLATFORM_LOGO_PATHS,
} from '~~/shared/constants/contact'
import type { PublicOfficialChannel } from '~~/shared/types/contracts'

/**
 * 官方联系清单：邮箱 + QQ + QQ群 共用一张卡内的细分隔线行。
 *
 * 二维码不再作为常驻卡面（三张方块图占掉了整段版面，而访客真正需要的是号码
 * 和一个能点的入口）。桌面 fine pointer 在 hover/focus 时用纯 CSS 浮层给出
 * 二维码，触屏与窄屏不出现；点击行为不变，仍是跳转官方短链。
 */
const props = defineProps<{
  channels: PublicOfficialChannel[]
  email: string
  emailSubject?: string | undefined
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
      :data-platform="channel.platform"
      :data-linked="Boolean(channel.href)"
      data-testid="contact-channel-row"
    >
      <dt class="contact-list__label">
        <img
          class="contact-list__logo"
          :src="channel.logoSrc"
          alt=""
          width="20"
          height="20"
          loading="lazy"
          decoding="async"
        >
        {{ channel.label }}
      </dt>
      <dd class="contact-list__value">
        <span class="contact-list__account">{{ channel.account }}</span>
        <!--
          有可用链接时给出行动按钮；解不出链接时只展示号码，
          由下方二维码承担添加路径，不渲染一个点不动的按钮。
        -->
        <span class="contact-list__actions">
          <span class="contact-list__qr-anchor">
            <PublicAction
              v-if="channel.href"
              variant="secondary"
              :href="channel.href"
              target="_blank"
              rel="noopener noreferrer"
              :aria-label="`${channel.actionLabel}：${channel.label} ${channel.account}`"
            >
              {{ channel.actionLabel }}
              <span aria-hidden="true">↗</span>
            </PublicAction>
            <!--
              纯展示浮层：读屏与触屏用户由行内的号码与二维码 alt 得到同样信息，
              因此这里不额外制造一个可聚焦元素。
            -->
            <span class="contact-list__qr" role="group" :aria-label="`${channel.label}二维码`">
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
              <span class="contact-list__qr-hint">扫码{{ channel.actionLabel }}</span>
            </span>
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

/*
 * 一行 = 标签 + 号码 + 行动。窄屏标签独占一行、号码与行动跟在下面，
 * 因此长邮箱不会把行动按钮挤出可视区。
 */
.contact-list__row {
  display: grid;
  gap: var(--space-2) var(--space-4);
  padding: var(--space-4);
}

.contact-list__row + .contact-list__row {
  border-top: 1px solid var(--public-border-secondary);
}

.contact-list__label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
}

/* 源 SVG 没有 fill，直出是纯黑；压到与标签同一灰阶，才不会比号码还抢眼。 */
.contact-list__logo {
  width: 1.25rem;
  height: 1.25rem;
  flex: none;
  object-fit: contain;
  opacity: 0.55;
}

/*
 * 号码靠左、行动靠右：号码不居中，三行的起始位置才能对成一列
 * （邮箱最长，居中会把它推到行中间，QQ 号码则缩在里侧）。
 */
.contact-list__value {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2) var(--space-4);
  margin: 0;
  min-width: 0;
}

/*
 * 号码与邮箱用正文黑体 + 等宽数字，不用宋体：宋体的阿拉伯数字字面窄、
 * 字重轻，和相邻的中文标签、按钮文字对不齐，看起来像另一种字体误入。
 * 等宽数字让三行号码的位宽一致，纵向能对成一列。
 */
.contact-list__account {
  min-width: 0;
  font-size: var(--font-size-md);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.01em;
  overflow-wrap: anywhere;
}

.contact-list__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  margin-inline-start: auto;
}

.contact-list__qr-anchor {
  position: relative;
  display: inline-flex;
}

/*
 * 每行的行动按钮等宽：文字长度不同（「复制邮箱」4 字、「添加好友」4 字、
 * 「打开邮件客户端」7 字）本来会让三行的按钮各是一个宽度，纵向看是锯齿。
 * 给一个下限并让文字居中，短标签补白到同宽，长标签自然撑开。
 */
.contact-list__actions :deep(.public-action) {
  min-width: 8.5rem;
  padding-inline: var(--space-4);
}

/*
 * 二维码默认就在文档流里：没有解出跳转链接的渠道没有按钮，
 * 扫码是它唯一的添加路径，任何设备上都必须看得见。
 */
.contact-list__qr {
  display: inline-grid;
  justify-items: center;
  gap: var(--space-1);
}

/* 有按钮时触屏直接点按钮，不必再占一块 150px 的图。 */
.contact-list__row[data-linked='true'] .contact-list__qr {
  display: none;
}

.contact-list__qr img {
  width: 9.375rem;
  height: auto;
  border-radius: var(--radius-xs);
  background: var(--image-placeholder);
}

.contact-list__qr-hint {
  color: var(--public-text-tertiary);
  font-size: var(--font-size-xs);
}

@media (min-width: 768px) {
  .contact-list__row {
    grid-template-columns: 5rem minmax(0, 1fr);
    align-items: center;
  }
}

/*
 * 桌面 fine pointer：二维码收进 hover/focus 浮层，行内只留号码与按钮。
 * 用 visibility 而不是 display，浮层才能有淡入；opacity 单独用 transition，
 * reduced-motion 下由下方媒体查询关掉。
 */
@media (hover: hover) and (pointer: fine) {
  /*
   * 只有带按钮的行才收进浮层：解不出链接的行没有可 hover 的按钮，
   * 浮层化会让它的二维码永远无法出现，而扫码是它唯一的添加路径。
   *
   * 靠右而不是居中：浮层比按钮宽，居中会探出卡片右边界；绝对定位元素
   * 会收缩到锚点宽度，所以还要显式给宽。
   */
  .contact-list__row[data-linked='true'] .contact-list__qr {
    display: inline-grid;
    position: absolute;
    right: 0;
    bottom: calc(100% + var(--space-2));
    z-index: 2;
    width: max-content;
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
  /* 选择器要与上方浮层规则同权重，否则这条 none 会被它的 transition 盖掉。 */
  .contact-list__row[data-linked='true'] .contact-list__qr {
    transition: none;
  }
}
</style>
