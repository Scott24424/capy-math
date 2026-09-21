# 곱셈 카피바라

초등학교 3학년이 집에서 혼자 곱셈을 연습하는 프로그램입니다.

## 아이에게 주기

    npm install
    npm run build

`dist/index.html` 파일 하나를 바탕화면에 복사해 주세요. 더블클릭하면 실행됩니다.
인터넷 연결은 필요 없습니다.

진도는 그 브라우저에 저장됩니다. 다른 컴퓨터로 옮기면 처음부터 시작합니다.

## 개발

    npm run dev      # 개발 서버
    npm test         # 테스트
    npm run build    # dist/index.html 만들기

곱셈 규칙은 전부 `src/core/` 안에 있고 테스트로 덮여 있습니다.
`src/ui/`는 그리기만 합니다.
