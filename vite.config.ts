import { defineConfig } from 'vite'

// 포트는 고정한다. 자동 증가(+1)로 옮겨 다니면 "열어 볼 주소"와 실제 주소가 갈린다.
export default defineConfig({
  // GitHub Pages는 /<저장소이름>/ 아래에 서비스된다. 상대 경로로 두면
  // Pages·로컬 preview·파일 열기가 전부 같은 산출물로 동작한다.
  base: './',
  build: {
    rollupOptions: {
      output: {
        // 획순 데이터(300자, 약 680KB)는 거의 안 바뀐다 — 따로 떼서 캐시가 살아 있게
        manualChunks: (id) => (id.includes('strokes.json') ? 'strokes' : undefined),
      },
    },
  },
  server: {
    host: 'localhost',
    port: 5300,
    strictPort: true,
  },
  preview: {
    host: 'localhost',
    port: 5300,
    strictPort: true,
  },
})
