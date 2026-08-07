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
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
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

/**
 * 부수(部首)는 4급II부터 출제 유형에 들어온다. 획순과 같은 출처(Make Me a Hanzi)의
 * dictionary.txt에 글자마다 부수가 들어 있어 그걸 받아 배정한자분만 추려 굽는다.
 * 한 번 받으면 node_modules/.cache에 두고 다시 쓴다(빌드마다 8MB를 받지 않게).
 */
const CACHE = join(ROOT, 'node_modules', '.cache', 'makemeahanzi-dictionary.txt')

async function radicalMap(): Promise<Record<string, string>> {
  let text: string
  if (existsSync(CACHE)) {
    text = readFileSync(CACHE, 'utf8')
  } else {
    const url = 'https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt'
    const res = await fetch(url)
    if (!res.ok) throw new Error(`부수 데이터를 못 받았다: ${res.status}`)
    text = await res.text()
    mkdirSync(dirname(CACHE), { recursive: true })
    writeFileSync(CACHE, text, 'utf8')
  }
  const map: Record<string, string> = {}
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    const j = JSON.parse(line) as { character: string; radical?: string }
    if (j.radical) map[j.character] = j.radical
  }
  return map
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

// 획순이 없는 글자는 필순에서 자동으로 빠진다 (급수가 올라갈수록 몇 자씩 나온다)
writeFileSync(join(OUT, 'no-strokes.json'), JSON.stringify(missing), 'utf8')

// ── 부수 ────────────────────────────────────────────────────
const radicals = await radicalMap()
const outRad: Record<string, string> = {}
const noRadical: string[] = []
for (const grade of LADDER) {
  for (const h of NEW_BY_GRADE[grade]) {
    const r = radicals[h.char] ?? radicals[STROKE_VARIANT[h.char] ?? '']
    if (r) outRad[h.char] = r
    else noRadical.push(h.char)
  }
}
writeFileSync(join(OUT, 'radicals.json'), JSON.stringify(outRad), 'utf8')

console.log(`총 ${totalChars}자, ${(totalBytes / 1024).toFixed(0)}KB (급수별 분할)`)
if (substituted.length) console.log(`  대체 자형 사용(필순 문제에서 제외됨): ${substituted.join(' ')}`)
if (missing.length) console.log(`  획순 없음(필순에서 제외됨) ${missing.length}자: ${missing.join(' ')}`)
console.log(`  부수: ${Object.keys(outRad).length}자${noRadical.length ? ` (없는 글자 ${noRadical.length}자: ${noRadical.join(' ')})` : ''}`)
