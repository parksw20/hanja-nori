/**
 * hanzi-writer-data(전체 한자)에서 우리 배정한자만 뽑아 src/data/strokes.json으로 굽는다.
 * 전체 패키지를 번들에 넣지 않기 위함 — 300자면 수백 KB로 끝난다.
 *
 * 실행: npm run data
 * 재실행 조건: 배정한자 목록이 바뀌었을 때.
 *
 * 한국 정자에 획순 데이터가 없는 글자(敎 飮 窓 淸)는 중국 자형으로 대신 굽고,
 * 자형이 다르므로 grades.ts의 NO_PILSUN이 필순 문제에서 제외한다.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'node_modules', 'hanzi-writer-data')
const DATA = join(ROOT, 'src', 'data')
const OUT = join(DATA, 'strokes.json')

// TS를 파싱하지 않고 한자만 뽑아낸다 (tsx 없이도 돌게).
const hanja8 = readFileSync(join(DATA, 'hanja8.ts'), 'utf8')
const grades = readFileSync(join(DATA, 'grades.ts'), 'utf8')

const chars = [
  ...[...hanja8.matchAll(/\{ char: '(.)'/g)].map((m) => m[1]),
  // grades.ts는 "'家 집 가|間 사이 간|...'" 형태의 표
  ...[...grades.matchAll(/([一-鿿]) [^|']+/g)].map((m) => m[1]),
]
const unique = [...new Set(chars)]

if (unique.length === 0) throw new Error('배정한자를 하나도 못 찾았다 — 데이터 파일 형식이 바뀌었다')

// 정자에 데이터가 없을 때 쓸 대체 자형 (grades.ts의 STROKE_VARIANT와 같아야 한다)
const VARIANT = { 敎: '教', 飮: '飲', 窓: '窗', 淸: '清' }

const out = {}
const missing = []
const substituted = []
for (const c of unique) {
  let src = c
  if (!existsSync(join(SRC, `${c}.json`))) {
    if (VARIANT[c] && existsSync(join(SRC, `${VARIANT[c]}.json`))) {
      src = VARIANT[c]
      substituted.push(`${c}→${src}`)
    } else {
      missing.push(c)
      continue
    }
  }
  const { strokes, medians } = JSON.parse(readFileSync(join(SRC, `${src}.json`), 'utf8'))
  out[c] = { strokes, medians }
}

if (missing.length) {
  throw new Error(
    `획순 데이터 없는 글자: ${missing.join(' ')} — VARIANT에 대체 자형을 넣거나 필순에서 빼야 한다`,
  )
}

writeFileSync(OUT, JSON.stringify(out), 'utf8')
const kb = (Buffer.byteLength(JSON.stringify(out)) / 1024).toFixed(0)
console.log(`strokes.json 생성: ${unique.length}자, ${kb}KB`)
if (substituted.length) console.log(`  대체 자형 사용(필순 문제에서 제외됨): ${substituted.join(' ')}`)
