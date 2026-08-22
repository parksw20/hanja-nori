import { readFileSync, writeFileSync } from "node:fs"
import { HANJA_8 } from "./src/data/hanja8"
import { HANJA_7II, HANJA_7, HANJA_6II, HANJA_6, HANJA_5II, HANJA_5, HANJA_4II, HANJA_4, HANJA_3II, HANJA_3 } from "./src/data/grades"
const all = [HANJA_8, HANJA_7II, HANJA_7, HANJA_6II, HANJA_6, HANJA_5II, HANJA_5, HANJA_4II, HANJA_4, HANJA_3II, HANJA_3].flat()
const rank: Record<string, number> = {}
const LAD = ["8","7II","7","6II","6","5II","5","4II","4","3II","3"]
const gradeOf: Record<string, string> = {}
for (const h of all) gradeOf[h.char] = h.grade
LAD.forEach((g,i)=>rank[g]=i)

const src = readFileSync("src/data/words.ts", "utf8")
const rows = [...src.matchAll(/^\s*'([^']+)\|([^']+)\|([^']*)',/gm)].map(m => ({ w: m[1], r: m[2], m: m[3] }))
const bad: string[] = []
const seen = new Set<string>()
for (const row of rows) {
  const missing = [...row.w].filter(c => !(c in gradeOf))
  if (missing.length) bad.push(`배정 밖: ${row.w} (${missing.join("")})`)
  if ([...row.w].length !== [...row.r].length) bad.push(`길이 불일치: ${row.w}/${row.r}`)
  if (!row.m.trim()) bad.push(`뜻 없음: ${row.w}`)
  if (seen.has(row.w)) bad.push(`중복: ${row.w}`)
  seen.add(row.w)
}
writeFileSync("bad.txt", bad.length ? bad.join("\n") : "문제 없음", "utf8")
