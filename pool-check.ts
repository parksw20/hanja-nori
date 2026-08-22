import { writeFileSync } from "node:fs"
import { LADDER, wordsUpTo, NEW_BY_GRADE } from "./src/data/words"
const out: string[] = ["급수\t낱말 누계\t이번 급수 낱말\t비율"]
for (const g of LADDER) {
  const pool = wordsUpTo(g)
  const fresh = pool.filter(w => w.grade === g).length
  out.push(`${g}\t${pool.length}\t${fresh}\t${(fresh / pool.length * 100).toFixed(1)}%`)
}
writeFileSync("pool.txt", out.join("\n"), "utf8")
