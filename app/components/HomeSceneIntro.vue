<script setup lang="ts">
/**
 * 首页 2-4 幕共用文字块，桌面呈现为与图片等高的文字卡。
 *
 * 需求4阶段 E：章节标题不再是脱离内容的左上独立一行，而是这张卡的一部分，
 * 与主媒体左右等高对位。三级字阶（eyebrow / 标题 / 导语）建立层次，
 * 标题下的细分隔线（CSS hairline，非字体衬线）收住标题簇。
 *
 * 首页不放防御性表述（"不代表已接单""不是最终报价"）：这些边界属于委托页与
 * 服务条款，首页只负责引导。
 *
 * 标题必须渲染真实 `<h2 :id>`：各幕的 `aria-labelledby` 指向它。
 */
const props = withDefaults(defineProps<{
  eyebrow: string
  /** 标题簇是否居中。只有自设委托幕用，用来平衡该幕左右观感。 */
  headingAlign?: 'center' | 'start'
  lead: string | null
  title: string
  titleId: string
}>(), {
  headingAlign: 'start',
})

/** 各幕入场动效需要真实根元素调用 `animate()`；组件实例本身没有该方法。 */
const rootRef = useTemplateRef<HTMLElement>('root')
defineExpose({ root: rootRef })
</script>

<template>
  <div ref="root" class="home-scene-intro" data-testid="home-scene-intro">
    <div
      class="home-scene-intro__heading"
      :data-align="props.headingAlign"
    >
      <p class="home-scene-intro__eyebrow">{{ eyebrow }}</p>
      <h2 :id="titleId" class="home-scene-intro__title">{{ title }}</h2>
    </div>

    <slot name="status" />

    <p v-if="lead" class="home-scene-intro__lead">{{ lead }}</p>

    <slot name="meta" />

    <div v-if="$slots.actions" class="home-scene-intro__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.home-scene-intro {
  display: grid;
  align-content: center;
  justify-items: start;
  gap: var(--space-4);
}

/* eyebrow 与标题是同一个标题簇，比块间距更紧。 */
.home-scene-intro__heading {
  display: grid;
  justify-items: start;
  gap: var(--space-2);
  /* 细分隔线（hairline）收住标题簇，与下方正文分层。 */
  width: 100%;
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--public-border-secondary);
}

/**
 * 只有自设委托幕居中标题簇，用来平衡该幕左右观感。
 * 居中只作用于标题簇：导语与行动仍左对齐，否则整卡会散。
 */
.home-scene-intro__heading[data-align='center'] {
  justify-items: center;
  text-align: center;
}

.home-scene-intro__eyebrow {
  margin: 0;
  color: var(--public-text-tertiary);
  font-size: var(--font-size-xs);
  font-weight: 700;
  letter-spacing: 0.16em;
}

.home-scene-intro__title {
  margin: 0;
  font-family: var(--font-public-display);
  font-size: var(--font-size-xl);
  font-weight: 600;
  line-height: var(--line-height-heading);
  letter-spacing: var(--letter-spacing-tight);
}

/* 第二层：导语承载正文，用 secondary 而非 tertiary 以保证 4.5:1 对比度。 */
.home-scene-intro__lead {
  margin: 0;
  color: var(--public-text-secondary);
  font-size: var(--font-size-lg);
  font-weight: 500;
  line-height: var(--line-height-normal);
}

.home-scene-intro__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

@media (min-width: 1024px) {
  /**
   * 桌面：文字卡与图片等高对位。
   * 卡片必须占满自己那一栏（不设 max-width、不靠 justify-items 缩宽），
   * 否则宽栏里塞窄内容会在栏内留下大片空白 —— 这是第二幕右侧空旷的根因。
   */
  .home-scene-intro {
    height: 100%;
    padding: var(--home-scene-card-padding);
    background: var(--public-bg-secondary);
    border: 1px solid var(--public-border-secondary);
    border-radius: var(--radius-image);
  }
}
</style>
