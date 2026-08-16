<script setup lang="ts">
import {
  PROJECT_ENGLISH_NAME,
  PROJECT_NAME,
} from "~~/shared/constants/project";
import { publicSiteMetaResponseSchema } from "~~/shared/schemas/site-meta";

/**
 * `brandOnly` 隐藏页脚导航，只留品牌与法务/备案信息。
 * 管理端登录页用它：备案信息要保留，访客导航不进登录流程。
 */
withDefaults(
  defineProps<{
    brandOnly?: boolean;
  }>(),
  {
    brandOnly: false,
  },
);

const shanghaiYear = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  timeZone: "Asia/Shanghai",
}).format(new Date());
const { data: filings } = await useFetch("/api/site-meta", {
  key: "public-site-meta",
  default: () => ({ icp: null, police: null }),
  transform: (raw) => publicSiteMetaResponseSchema.parse(raw).data.filings,
});
</script>

<template>
  <footer class="public-footer" data-testid="public-footer">
    <div class="public-footer__inner">
      <div class="public-footer__brand">
        <p class="public-footer__name">
          {{ PROJECT_NAME }}
        </p>
        <p class="public-footer__sub">
          {{ PROJECT_ENGLISH_NAME }}
        </p>
      </div>

      <div class="public-footer__center">
        <nav v-if="!brandOnly" class="public-footer__nav" aria-label="页脚导航">
          <NuxtLink
            v-for="item in PUBLIC_NAV_ITEMS"
            :key="item.href"
            :to="item.href"
            class="public-footer__link"
          >
            {{ item.label }}
          </NuxtLink>
        </nav>

        <p
          v-if="filings.icp || filings.police"
          class="public-footer__filings"
          aria-label="网站备案信息"
        >
          <template v-if="filings.icp">
            <a
              :href="filings.icp.url"
              target="_blank"
              rel="noopener noreferrer"
              >{{ filings.icp.number }}</a
            >
          </template>
          <template v-if="filings.police">
            <span v-if="filings.icp" aria-hidden="true">|</span>
            <a
              :href="filings.police.url"
              class="public-footer__police-filing"
              target="_blank"
              rel="noopener noreferrer"
              ><img
                src="/filings/police-filing.png"
                alt=""
                width="18"
                height="20"
                aria-hidden="true"
              ><span>{{ filings.police.number }}</span></a
            >
          </template>
        </p>
      </div>

      <div class="public-footer__legal">
        <p class="public-footer__copyright">
          © 2026-{{ shanghaiYear }} {{ PROJECT_NAME }}.
          {{ PROJECT_ENGLISH_NAME }}. All Rights Reserved.
        </p>
        <p class="public-footer__legal-links">
          <NuxtLink to="/service">服务条款</NuxtLink>
          <span aria-hidden="true">|</span>
          <NuxtLink to="/privacy">隐私政策</NuxtLink>
          <span aria-hidden="true">｜</span>
          <NuxtLink to="/licenses">开源软件声明</NuxtLink>
          <span aria-hidden="true">|</span>
          <span>
            Design by
            <a
              href="https://github.com/wangminan"
              target="_blank"
              rel="noopener noreferrer"
              >Arktouros</a
            >
            &amp;
            <a
              href="https://github.com/lingxunfurry"
              target="_blank"
              rel="noopener noreferrer"
              >LingXun</a
            >
          </span>
        </p>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.public-footer {
  padding: calc(var(--space-4) + var(--space-1)) var(--public-page-padding)
    var(--space-4);
  background: var(--public-bg-secondary);
  border-top: 1px solid var(--public-border-secondary);
}

.public-footer__inner {
  display: grid;
  gap: var(--space-4);
  max-width: var(--public-content-wide);
  margin: 0 auto;
}

.public-footer__center {
  display: grid;
  gap: var(--space-2);
}

.public-footer__name {
  font-family: var(--font-public-display);
  font-size: var(--font-size-lg);
  line-height: var(--line-height-heading);
}

.public-footer__sub {
  margin-top: var(--space-2);
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
}

.public-footer__nav {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3) var(--space-4);
}

.public-footer__link {
  color: var(--public-text-primary);
  font-size: var(--font-size-sm);
}

.public-footer__link:hover {
  color: var(--public-accent-primary);
}

.public-footer__filings {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-2);
  color: var(--public-text-secondary);
  font-size: var(--font-size-xs);
  overflow-wrap: anywhere;
}

.public-footer__filings a {
  color: inherit;
}

.public-footer__police-filing {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.public-footer__police-filing img {
  flex: none;
  width: 1.125rem;
  height: 1.25rem;
  object-fit: contain;
}

.public-footer__filings a:hover {
  color: var(--public-accent-primary);
}

.public-footer__legal {
  display: grid;
  gap: var(--space-2);
  color: var(--public-text-secondary);
  font-size: var(--font-size-xs);
}

.public-footer__legal-links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-2);
  overflow-wrap: anywhere;
}

.public-footer__legal a {
  color: inherit;
}

.public-footer__legal a:hover {
  color: var(--public-accent-primary);
}

@media (min-width: 1200px) {
  .public-footer__inner {
    grid-template-columns: max-content minmax(0, 1fr) max-content;
    align-items: end;
    column-gap: clamp(var(--space-5), 3vw, var(--space-8));
  }

  .public-footer__center {
    justify-items: center;
    text-align: center;
  }

  .public-footer__nav,
  .public-footer__filings {
    justify-content: center;
  }

  .public-footer__legal {
    justify-items: end;
    text-align: right;
  }

  .public-footer__copyright,
  .public-footer__legal-links {
    white-space: nowrap;
  }

  .public-footer__legal-links {
    flex-wrap: nowrap;
  }
}
</style>
