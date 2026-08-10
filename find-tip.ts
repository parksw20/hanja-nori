import { LEVELS, parseLevel, roll, cells, isSupported } from "./src/games/bloxorz"
import type { Dir } from "./src/games/bloxorz"
const DIRS: Dir[] = ["up","down","left","right"]
for (let i = 0; i < LEVELS.length; i++) {
  const lv = parseLevel(LEVELS[i])
  const floor = (r:number,c:number) => r>=0 && r<lv.rows && c>=0 && c<lv.cols && lv.grid[r][c]!==0
  // 시작에서 두 수 이내
  const seen = new Map<string, Dir[]>([[`${lv.start.r},${lv.start.c},${lv.start.o}`, []]])
  let frontier = [lv.start]
  for (let depth = 0; depth < 3; depth++) {
    const next = []
    for (const b of frontier) {
      const path = seen.get(`${b.r},${b.c},${b.o}`)!
      for (const d of DIRS) {
        const nb = roll(b, d)
        const cs = cells(nb)
        const held = cs.filter(([r,c]) => floor(r,c)).length
        if (cs.length === 2 && held === 1) {
          console.log(`레벨 ${i+1}: ${[...path,d].join(" ")} -> ${nb.o} (${nb.r},${nb.c}) 걸친칸 1`)
          process.exit(0)
        }
        if (!isSupported(lv, nb)) continue
        const k = `${nb.r},${nb.c},${nb.o}`
        if (seen.has(k)) continue
        seen.set(k, [...path, d])
        next.push(nb)
      }
    }
    frontier = next
  }
}
console.log("없음")
