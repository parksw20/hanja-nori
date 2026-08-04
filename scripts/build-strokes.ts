/**
 * hanzi-writer-data(9,574자)에서 우리 배정한자만 뽑아 **급수별로** 굽는다.
 *
 *   src/data/strokes-8.json    ← 8급 신규 50자
 *   src/data/strokes-7II.json  ← 7급II 신규 50자
 *   ...
 *
 * 한 덩어리로 구우면 8급만 하는 아이도 6급 한자 획순까지 첫 화면에서 다 받는다.
 * 급수별로 나눠 두면 그 급수에 들어갈 때만 받으면 된다 (src/strokes.ts가 이어서 처리).
 *
 * 실행: npm run data
 * 재실행 조건: 배정한자 목록이 바뀌었을 때.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { LADDER, NEW_BY_GRADE } from '../src/data/words'
import { STROKE_VARIANT } from '../src/data/grades'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'node_modules', 'hanzi-writer-data')
const OUT = join(ROOT, 'src', 'data')

interface Stroke {
  strokes: string[]
  medians: number[][][]
}

const missing: string[] = []
const substituted: string[] = []
let totalChars = 0
let totalBytes = 0

for (const grade of LADDER) {
  const chars = NEW_BY_GRADE[grade].map((h) => h.char)
  if (chars.length === 0) continue

  const out: Record<string, Stroke> = {}
  for (const c of chars) {
    // 한국 정자에 데이터가 없으면 중국 자형으로 대신한다 (자형이 달라 필순 문제에서는 제외된다)
    let src = c
    if (!existsSync(join(SRC, `${c}.json`))) {
      const alt = STROKE_VARIANT[c]
      if (alt && existsSync(join(SRC, `${alt}.json`))) {
        src = alt
        substituted.push(`${c}→${alt}`)
      } else {
        missing.push(c)
        continue
      }
    }
    const { strokes, medians } = JSON.parse(readFileSync(join(SRC, `${src}.json`), 'utf8')) as Stroke
    out[c] = { strokes, medians }
  }

  const json = JSON.stringify(out)
  writeFileSync(join(OUT, `strokes-${grade}.json`), json, 'utf8')
  totalChars += chars.length
  totalBytes += Buffer.byteLength(json)
  console.log(`  strokes-${grade}.json  ${chars.length}자  ${(Buffer.byteLength(json) / 1024).toFixed(0)}KB`)
}

if (missing.length) {
  throw new Error(
    `획순 데이터 없는 글자: ${missing.join(' ')} — grades.ts의 STROKE_VARIANT에 대체 자형을 넣거나 필순에서 빼야 한다`,
  )
}

console.log(`총 ${totalChars}자, ${(totalBytes / 1024).toFixed(0)}KB (급수별 분할)`)
if (substituted.length) console.log(`  대체 자형 사용(필순 문제에서 제외됨): ${substituted.join(' ')}`)
