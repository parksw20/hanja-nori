import { writeFileSync } from "node:fs"
import { HANJA_4II, HANJA_4, HANJA_3II, HANJA_3 } from "./src/data/grades"
const out = [["4II",HANJA_4II],["4",HANJA_4],["3II",HANJA_3II],["3",HANJA_3]] as const
writeFileSync("scratch-chars.txt", out.map(([n,hs])=>`=== ${n} (${hs.length}) ===\n`+hs.map(h=>h.char).join("")).join("\n\n"), "utf8")
