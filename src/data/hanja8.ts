import type { Hanja, Word } from './types'

/**
 * 8급 배정한자 50자 (사단법인 한국어문회 전국한자능력검정시험).
 * 8급은 읽기 50자 / 쓰기 배정 없음.
 *
 * 획수·획순은 여기 적지 않는다 — src/data/strokes.json(생성물)에서 계산해 쓴다.
 * 부수는 8급 출제 유형이 아니므로 MVP에서 제외 (6급부터 필요).
 */
export const HANJA_8: Hanja[] = [
  { char: '敎', hun: '가르칠', eum: '교', grade: '8' },
  { char: '校', hun: '학교', eum: '교', grade: '8' },
  { char: '九', hun: '아홉', eum: '구', grade: '8' },
  { char: '國', hun: '나라', eum: '국', grade: '8' },
  { char: '軍', hun: '군사', eum: '군', grade: '8' },
  { char: '金', hun: '쇠', eum: '금', grade: '8', alt: { hun: '성', eum: '김' } },
  { char: '南', hun: '남녘', eum: '남', grade: '8' },
  { char: '女', hun: '계집', eum: '녀', grade: '8' },
  { char: '年', hun: '해', eum: '년', grade: '8' },
  { char: '大', hun: '큰', eum: '대', grade: '8' },
  { char: '東', hun: '동녘', eum: '동', grade: '8' },
  { char: '六', hun: '여섯', eum: '륙', grade: '8' },
  { char: '萬', hun: '일만', eum: '만', grade: '8' },
  { char: '母', hun: '어미', eum: '모', grade: '8' },
  { char: '木', hun: '나무', eum: '목', grade: '8' },
  { char: '門', hun: '문', eum: '문', grade: '8' },
  { char: '民', hun: '백성', eum: '민', grade: '8' },
  { char: '白', hun: '흰', eum: '백', grade: '8' },
  { char: '父', hun: '아비', eum: '부', grade: '8' },
  { char: '北', hun: '북녘', eum: '북', grade: '8', alt: { hun: '달아날', eum: '배' } },
  { char: '四', hun: '넉', eum: '사', grade: '8' },
  { char: '山', hun: '메', eum: '산', grade: '8' },
  { char: '三', hun: '석', eum: '삼', grade: '8' },
  { char: '生', hun: '날', eum: '생', grade: '8' },
  { char: '西', hun: '서녘', eum: '서', grade: '8' },
  { char: '先', hun: '먼저', eum: '선', grade: '8' },
  { char: '小', hun: '작을', eum: '소', grade: '8' },
  { char: '水', hun: '물', eum: '수', grade: '8' },
  { char: '室', hun: '집', eum: '실', grade: '8' },
  { char: '十', hun: '열', eum: '십', grade: '8' },
  { char: '五', hun: '다섯', eum: '오', grade: '8' },
  { char: '王', hun: '임금', eum: '왕', grade: '8' },
  { char: '外', hun: '바깥', eum: '외', grade: '8' },
  { char: '月', hun: '달', eum: '월', grade: '8' },
  { char: '二', hun: '두', eum: '이', grade: '8' },
  { char: '人', hun: '사람', eum: '인', grade: '8' },
  { char: '一', hun: '한', eum: '일', grade: '8' },
  { char: '日', hun: '날', eum: '일', grade: '8' },
  { char: '長', hun: '긴', eum: '장', grade: '8' },
  { char: '弟', hun: '아우', eum: '제', grade: '8' },
  { char: '中', hun: '가운데', eum: '중', grade: '8' },
  { char: '靑', hun: '푸를', eum: '청', grade: '8' },
  { char: '寸', hun: '마디', eum: '촌', grade: '8' },
  { char: '七', hun: '일곱', eum: '칠', grade: '8' },
  { char: '土', hun: '흙', eum: '토', grade: '8' },
  { char: '八', hun: '여덟', eum: '팔', grade: '8' },
  { char: '學', hun: '배울', eum: '학', grade: '8' },
  { char: '韓', hun: '한국', eum: '한', grade: '8' },
  { char: '兄', hun: '형', eum: '형', grade: '8' },
  { char: '火', hun: '불', eum: '화', grade: '8' },
]

/**
 * 8급 한자어 — 독음 문제의 재료.
 * 모든 글자는 위 50자 안에 있어야 한다 (test/data.test.ts가 강제).
 * 두음법칙·활음조가 걸리는 낱말(六月→유월, 十月→시월, 女軍→여군)을 일부러 넣었다.
 */
export const WORDS_8: Word[] = [
  { word: '大韓民國', reading: '대한민국', meaning: '우리나라의 이름', grade: '8' },
  { word: '學校', reading: '학교', meaning: '학생을 가르치는 곳', grade: '8' },
  { word: '敎室', reading: '교실', meaning: '수업을 하는 방', grade: '8' },
  { word: '學生', reading: '학생', meaning: '배우는 사람', grade: '8' },
  { word: '先生', reading: '선생', meaning: '가르치는 사람', grade: '8' },
  { word: '校長', reading: '교장', meaning: '학교의 우두머리', grade: '8' },
  { word: '校門', reading: '교문', meaning: '학교의 문', grade: '8' },
  { word: '父母', reading: '부모', meaning: '아버지와 어머니', grade: '8' },
  { word: '母女', reading: '모녀', meaning: '어머니와 딸', grade: '8' },
  { word: '父兄', reading: '부형', meaning: '아버지와 형', grade: '8' },
  { word: '兄弟', reading: '형제', meaning: '형과 아우', grade: '8' },
  { word: '長女', reading: '장녀', meaning: '맏딸', grade: '8' },
  { word: '三寸', reading: '삼촌', meaning: '아버지의 형제', grade: '8' },
  { word: '四寸', reading: '사촌', meaning: '삼촌의 자녀', grade: '8' },
  { word: '軍人', reading: '군인', meaning: '군대에 있는 사람', grade: '8' },
  { word: '國軍', reading: '국군', meaning: '나라의 군대', grade: '8' },
  { word: '女軍', reading: '여군', meaning: '여자 군인', grade: '8' },
  { word: '國民', reading: '국민', meaning: '나라를 이루는 사람들', grade: '8' },
  { word: '王室', reading: '왕실', meaning: '임금의 집안', grade: '8' },
  { word: '女王', reading: '여왕', meaning: '여자 임금', grade: '8' },
  { word: '韓國', reading: '한국', meaning: '우리나라', grade: '8' },
  { word: '中國', reading: '중국', meaning: '우리나라 서쪽의 나라', grade: '8' },
  { word: '外國', reading: '외국', meaning: '다른 나라', grade: '8' },
  { word: '萬國', reading: '만국', meaning: '세계의 모든 나라', grade: '8' },
  { word: '三國', reading: '삼국', meaning: '세 나라', grade: '8' },
  { word: '南山', reading: '남산', meaning: '남쪽에 있는 산', grade: '8' },
  { word: '火山', reading: '화산', meaning: '불을 뿜는 산', grade: '8' },
  { word: '山水', reading: '산수', meaning: '산과 물, 경치', grade: '8' },
  { word: '生水', reading: '생수', meaning: '먹는 맑은 물', grade: '8' },
  { word: '東西', reading: '동서', meaning: '동쪽과 서쪽', grade: '8' },
  { word: '南北', reading: '남북', meaning: '남쪽과 북쪽', grade: '8' },
  { word: '大門', reading: '대문', meaning: '큰 문', grade: '8' },
  { word: '東門', reading: '동문', meaning: '동쪽 문', grade: '8' },
  { word: '靑山', reading: '청산', meaning: '푸른 산', grade: '8' },
  { word: '靑年', reading: '청년', meaning: '젊은 사람', grade: '8' },
  { word: '年金', reading: '연금', meaning: '해마다 받는 돈', grade: '8' },
  { word: '萬年', reading: '만년', meaning: '아주 오랜 세월', grade: '8' },
  { word: '白金', reading: '백금', meaning: '흰빛의 귀한 쇠', grade: '8' },
  { word: '白人', reading: '백인', meaning: '살빛이 흰 사람', grade: '8' },
  { word: '土木', reading: '토목', meaning: '흙과 나무로 하는 공사', grade: '8' },
  { word: '室外', reading: '실외', meaning: '방이나 건물의 바깥', grade: '8' },
  { word: '校外', reading: '교외', meaning: '학교의 바깥', grade: '8' },
  { word: '中小', reading: '중소', meaning: '중간과 작은 것', grade: '8' },
  { word: '大人', reading: '대인', meaning: '어른', grade: '8' },
  { word: '小人', reading: '소인', meaning: '어린 사람', grade: '8' },
  { word: '生日', reading: '생일', meaning: '태어난 날', grade: '8' },
  { word: '一日', reading: '일일', meaning: '하루', grade: '8' },
  { word: '二月', reading: '이월', meaning: '두 번째 달', grade: '8' },
  { word: '五月', reading: '오월', meaning: '다섯 번째 달', grade: '8' },
  { word: '六月', reading: '유월', meaning: '여섯 번째 달', grade: '8' },
  { word: '七月', reading: '칠월', meaning: '일곱 번째 달', grade: '8' },
  { word: '八月', reading: '팔월', meaning: '여덟 번째 달', grade: '8' },
  { word: '九月', reading: '구월', meaning: '아홉 번째 달', grade: '8' },
  { word: '十月', reading: '시월', meaning: '열 번째 달', grade: '8' },
]

/** char → Hanja 조회표 */
export const BY_CHAR: ReadonlyMap<string, Hanja> = new Map(HANJA_8.map((h) => [h.char, h]))

/** 훈음을 '가르칠 교' 한 덩어리로 */
export function hunEum(h: Hanja): string {
  return `${h.hun} ${h.eum}`
}
