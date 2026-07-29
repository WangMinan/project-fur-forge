export interface ProductionContentLeak {
  file: string
  label: string
}

export const PRODUCTION_BLOCKED_CONTENT: ReadonlyArray<{
  label: string
  pattern: RegExp
}>

export function findProductionContentLeaks(
  roots: readonly string[],
): Promise<ProductionContentLeak[]>

export function guardProductionContent(options: {
  appEnv: string | undefined
  roots: readonly string[]
}): Promise<ProductionContentLeak[]>
