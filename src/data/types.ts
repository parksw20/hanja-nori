/** 급수 식별자. 8급 → '8', 7급II → '7II' 처럼 쓴다. */
export type GradeId = '8' | '7II' | '7' | '6II' | '6' | '5II' | '5'

/** 급수 이름 표기 (화면·오류 메시지용) */
export const GRADE_NAME: Readonly<Record<GradeId, string>> = {
  '8': '8급',
  '7II': '7급II',
  '7': '7급',
  '6II': '6급II',
  '6': '6급',
  '5II': '5급II',
  '5': '5급',
}

/** 배정한자 한 글자. 획수·부수처럼 데이터에서 계산 가능한 값은 여기 손으로 적지 않는다. */
export interface Hanja {
  /** 한자 한 글자 */
  char: string
  /** 대표 훈(뜻) — 예: '가르칠' */
  hun: string
  /** 대표 음(소리) — 예: '교' */
  eum: string
  /** 이 글자가 처음 배정되는 급수 */
  grade: GradeId
  /** 두 번째 훈음이 있으면 (예: 金 쇠 금 / 성 김) */
  alt?: { hun: string; eum: string }
}

/** 한자어(낱말). 독음 문제와 한자쓰기 문제의 재료. */
export interface Word {
  /** 한자로 쓴 낱말 — 모든 글자가 해당 급수 배정한자 안에 있어야 한다 */
  word: string
  /** 한글 독음 — 글자 수가 word와 같아야 한다 (두음법칙 반영: 六月 → 유월) */
  reading: string
  /** 뜻풀이 (뜻풀이 문제와 힌트에 쓴다) */
  meaning: string
  grade: GradeId
}

/** hanzi-writer 획순 데이터 (scripts/build-strokes.mjs가 생성) */
export interface StrokeData {
  strokes: string[]
  medians: number[][][]
}
