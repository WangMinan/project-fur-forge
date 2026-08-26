<template>
  <header
    class="adoption-archive-header"
    data-testid="adoption-archive-header"
  >
    <div class="adoption-archive-header__display" aria-hidden="true">
      <span>ADOPTIONS</span>
    </div>

    <img
      class="adoption-archive-header__mark"
      src="/brand/logo-mark.png"
      alt=""
      aria-hidden="true"
      width="1600"
      height="1600"
    >

    <div class="adoption-archive-header__title-group">
      <h1 id="adoptions-page-title" class="adoption-archive-header__title">设定领养</h1>
    </div>
  </header>
</template>

<style scoped>
.adoption-archive-header {
  position: relative;
  display: grid;
  align-content: end;
  min-height: clamp(10rem, 14vw, 13rem);
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: var(--space-4) var(--public-page-padding);
  overflow: clip;
  isolation: isolate;
}

.adoption-archive-header__display {
  position: absolute;
  inset: clamp(1rem, 2vw, 1.75rem) 0 auto;
  z-index: -1;
  display: grid;
  color: var(--public-background-type);
  font-family: var(--font-role-display-sans);
  font-size: clamp(6rem, 11vw, 10rem);
  font-weight: 700;
  line-height: 0.66;
  letter-spacing: var(--type-display-letter-spacing);
  pointer-events: none;
  user-select: none;
}

.adoption-archive-header__display span {
  justify-self: start;
}

.adoption-archive-header__mark {
  position: absolute;
  inset: clamp(-1.5rem, -1.2vw, -0.75rem) clamp(0.5rem, 3vw, 3rem) auto auto;
  z-index: -1;
  width: clamp(13rem, 18vw, 17rem);
  height: auto;
  object-fit: contain;
  opacity: 0.055;
  filter: grayscale(1);
  transform: translate(8%, -8%) rotate(12deg);
  transform-origin: center;
  pointer-events: none;
  user-select: none;
}

.adoption-archive-header__title-group {
  width: min(100%, 38rem);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--public-text-primary);
}

.adoption-archive-header__title {
  margin-top: var(--space-1);
  font-family: var(--font-role-display);
  font-size: clamp(3.5rem, 5.5vw, 5.5rem);
  font-weight: var(--type-display-weight);
  line-height: 0.9;
  letter-spacing: var(--type-display-letter-spacing);
}

@media (max-width: 767px) {
  .adoption-archive-header {
    min-height: 10.5rem;
    padding-top: var(--space-4);
    padding-bottom: var(--space-3);
  }

  .adoption-archive-header__display {
    inset-block-start: 2.25rem;
    font-size: clamp(2.35rem, 9.8vw, 4rem);
    line-height: 0.72;
  }

  .adoption-archive-header__mark {
    inset: 0.5rem -1rem auto auto;
    width: 7.5rem;
    opacity: 0.045;
    transform: rotate(12deg);
  }

  .adoption-archive-header__title {
    font-size: clamp(3rem, 14vw, 3.75rem);
  }
}
</style>
