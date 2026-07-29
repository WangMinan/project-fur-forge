# Design Tokens：管理端

> **设计哲学**：Quiet Editorial Tool。白色/浅灰工作区，品牌蓝作为操作色而非大面积背景。

## Color

```text
--admin-bg-primary:          #FFFFFF
--admin-bg-workspace:        #F5F7FA
--admin-bg-subtle:           #EEF1F5
--admin-bg-inverse:          #1D2D5A

--admin-text-primary:        #20242B
--admin-text-secondary:      #626A75
--admin-text-tertiary:       #8B929C
--admin-text-inverse:        #FFFFFF

--admin-border-primary:      #D9DEE6
--admin-border-secondary:    #E9ECF1
--admin-border-focus:        #324DAF

--admin-accent-primary:      #324DAF
--admin-accent-hover:        #293C84
--admin-accent-decorative:   #6274BB
--admin-accent-tint:         #CED3E5

--admin-status-success:      #2F7B5C
--admin-status-success-soft: #E5F2EC
--admin-status-warning:      #946124
--admin-status-warning-soft: #F8EEDC
--admin-status-error:        #A63D40
--admin-status-error-soft:   #F8E6E7
--admin-status-info:         #426C9A
--admin-status-info-soft:    #E5EEF7

--admin-danger:              #A63D40
--admin-danger-hover:        #8F3034
--admin-focus-ring:          rgba(50, 77, 175, 0.30)
--admin-overlay:             rgba(24, 28, 35, 0.55)
```

使用规则：

- 侧栏优先白色或浅灰；反向深蓝只允许窄区域和极少场景，不把整站做成深色 Dashboard。
- 主行动、当前导航和焦点使用品牌蓝；普通保存、列表行和表单背景保持中性。
- `#6274BB` 只作装饰或大字号，`#CED3E5` 只作弱背景/边界。
- 发布、READY、草稿、失败、下架使用稳定语义色并配文字/图标。
- 危险色只用于高影响或不可逆动作。

## Typography

```text
--font-admin:
  "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif
--font-admin-mono:
  ui-monospace, "SFMono-Regular", Consolas, monospace

--admin-font-xs:   0.75rem
--admin-font-sm:   0.875rem
--admin-font-base: 1rem
--admin-font-md:   1.125rem
--admin-font-lg:   1.375rem
--admin-font-xl:   1.75rem
--admin-font-2xl:  2.25rem

--admin-line-tight:  1.2
--admin-line-normal: 1.5
--admin-line-dense:  1.35
```

管理端控件只使用无衬线；作品公开预览可以继承公开站展示字体。

## Spacing and Density

```text
--admin-space-0: 0
--admin-space-1: 0.25rem
--admin-space-2: 0.5rem
--admin-space-3: 0.75rem
--admin-space-4: 1rem
--admin-space-5: 1.25rem
--admin-space-6: 1.5rem
--admin-space-7: 2rem
--admin-space-8: 3rem
--admin-space-9: 4rem

--admin-control-height-sm: 2rem
--admin-control-height:    2.75rem
--admin-control-height-lg: 3rem
--admin-touch-target:      2.75rem
```

4px 为控件密度基准，8px 为区块节奏；主要触控目标至少 44px。

## Layout

```text
--admin-sidebar-width:        15rem
--admin-sidebar-collapsed:    4.5rem
--admin-content-max:          100rem
--admin-reading-max:          48rem
--admin-editor-main-min:      38rem
--admin-editor-preview-width: 24rem

--admin-radius-sm: 0.375rem
--admin-radius-md: 0.625rem
--admin-radius-lg: 0.875rem

--admin-shadow-popover: 0 0.75rem 2.5rem rgba(25, 31, 42, 0.12)
--admin-shadow-modal:   0 1.5rem 4rem rgba(25, 31, 42, 0.22)
```

- 常规编辑使用页面，不用全屏弹窗。
- 圆角用于控件和明确分组，不把每一行和字段包装成重卡片。
- 预览栏可粘性定位，但不得压缩主表单到不可用宽度。

## Forms and State

```text
--admin-error-border-width: 1px
--admin-focus-width:        3px
--admin-progress-height:    0.5rem
--admin-table-row-min:      3.25rem
```

- 字段状态同时提供文字、图标和边框。
- 发布检查分为已满足、缺失、处理中、阻断。
- 长任务状态保留在页面内；Toast 只作补充。
- “授权记录（可选）”不得使用必填星号或阻断色。
- 媒体状态使用“私有上传 / 校验 / 私有 READY / 生成公开图 / 已发布 / 清理失败”等真实语义，不显示 ACL 切换。

## Motion

```text
--admin-duration-instant: 50ms
--admin-duration-fast:    120ms
--admin-duration-normal:  180ms
--admin-duration-slow:    250ms
--admin-easing:           cubic-bezier(0.22, 1, 0.36, 1)
```

管理端无装饰入场动画；动效只解释菜单、步骤、上传、排序和对话框。

## Breakpoints and Review Viewports

```text
--admin-breakpoint-mobile:  390px
--admin-breakpoint-tablet:  768px
--admin-breakpoint-desktop: 1280px
--admin-breakpoint-wide:    1536px
```

固定视觉回归：390 × 844、768 × 1024、1440 × 900。手机只验收已锁定轻量能力。
