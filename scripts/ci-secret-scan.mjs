/**
 * T34-F7 CI secret / content 扫描。
 *
 * 目的：阻止真实凭据、真实私有 Object Key 和 Docker Hub PAT 进入版本控制。
 * 只扫描版本控制内的文件，不读 .env。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'

const TEXT_EXTENSIONS = /\.(?:ts|tsx|js|mjs|cjs|vue|json|ya?ml|md|sql|sh|conf|template|example)$/u

// 允许出现在示例与文档里的占位值。
const PLACEHOLDER = /(?:<[^>]+>|example\.invalid|your-dockerhub-username|REPLACE_ME|\$\{[^}]+\})/u

// 明确自我标注为测试/开发/示例的固定字面量不是真实凭据。
// 只认这些前缀，避免把"看起来很长"的真实密钥放过。
const NON_SECRET_LITERAL = /['"](?:test|development|production|dev|fake|dummy|example|sample)[A-Za-z0-9/+=_-]*-(?:session-)?secret[A-Za-z0-9/+=_-]*['"]/iu

const RULES = [
  {
    name: 'Aliyun access key id',
    pattern: /\bLTAI[0-9A-Za-z]{12,}\b/u,
  },
  {
    name: 'Docker Hub personal access token',
    pattern: /\bdckr_pat_[0-9A-Za-z_-]{16,}\b/u,
  },
  {
    name: 'PEM private key',
    pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/u,
  },
  {
    name: 'AWS-style secret assignment',
    pattern: /(?:secret|password|token)\s*[:=]\s*['"][A-Za-z0-9/+=_-]{24,}['"]/iu,
  },
]

const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split('\n')
  .map(line => line.trim())
  .filter(Boolean)
  .filter(file => TEXT_EXTENSIONS.test(file))

const findings = []
for (const file of files) {
  let content
  try {
    if (statSync(file).size > 2_000_000) {
      continue
    }
    content = readFileSync(file, 'utf8')
  }
  catch {
    continue
  }
  for (const [index, line] of content.split('\n').entries()) {
    if (PLACEHOLDER.test(line) || NON_SECRET_LITERAL.test(line)) {
      continue
    }
    for (const rule of RULES) {
      if (rule.pattern.test(line)) {
        findings.push(`${file}:${index + 1} ${rule.name}`)
      }
    }
  }
}

if (findings.length > 0) {
  // 只报告位置与规则名，绝不回显命中的内容。
  process.stderr.write(`Secret scan found ${findings.length} issue(s):\n`)
  for (const finding of findings) {
    process.stderr.write(`  ${finding}\n`)
  }
  process.exit(1)
}

process.stdout.write(`Secret scan clean across ${files.length} tracked files.\n`)
