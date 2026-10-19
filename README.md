# power0802m.com

중앙 문구와 점 애니메이션으로 구성된 제작 중 페이지입니다. 모션그래픽은 사용하지 않습니다. 외부 패키지·이미지·폰트 요청 없이 작동합니다.

## 미리 보기

Node.js 22 이상에서 실행하세요. 간단한 파일 미리보기에는 패키지 설치가 필요 없습니다.

```sh
npm run dev
```

브라우저에서 http://127.0.0.1:5173 을 엽니다. 종료는 터미널에서 `Ctrl+C`입니다.

## Cloudflare Workers + Git 자동 배포

GitHub 저장소는 `https://github.com/pipeCHeck/261019_power0802m_com`, 운영 브랜치는 `master`입니다. 이 브랜치에 **push**하면 Workers Builds가 배포하도록 연결합니다.

`wrangler.jsonc`의 Worker 이름은 `power0802m`, 파일 경로는 `./public`입니다. Workers Static Assets로 HTML·CSS·JS·폰트를 제공하며 별도의 서버 코드나 사이트 빌드는 필요하지 않습니다. 기존 `_headers`의 응답 헤더와 캐시 설정도 사용합니다.

1. Cloudflare의 **Workers & Pages → Create application**에서 **GitHub 저장소 연결 / Import a repository**로 새 **Worker**를 만듭니다.
2. `pipeCHeck/261019_power0802m_com`을 선택합니다. GitHub 앱 권한에 해당 저장소가 포함되어 있어야 합니다.
3. 다음 값으로 설정합니다.

   | 설정 | 값 |
   | --- | --- |
   | Worker 이름 | `power0802m`（Wrangler 설정과 동일） |
   | 운영 브랜치 | `master` |
   | Build command | 비워 두기 |
   | Deploy command | `npm run deploy` |
   | Root directory | 기본값, 저장소 루트 |
   | Node.js | 22 이상（필요 시 빌드 환경 변수 `NODE_VERSION=24`） |

4. 첫 배포가 끝나면 반환된 `*.workers.dev` 주소에서 사이트를 확인합니다.
5. Worker의 **Settings → Domains & Routes → Add → Custom Domain**에서 `power0802m.com`을 연결합니다. 도메인은 같은 Cloudflare 계정에 있어야 합니다. `www`도 사용할 경우 별도로 추가합니다.
6. Worker와 도메인의 정상 동작을 확인한 후 기존 Pages 프로젝트를 정리할 수 있습니다.

이후에는 다음 흐름으로 사이트가 갱신됩니다.

```sh
git add public package.json package-lock.json wrangler.jsonc
git commit -m "Update coming-soon page"
git push
```

Worker의 Builds/Deployments에서 해당 커밋의 배포 성공을 확인합니다. 최초 Workers Builds 연결과 사용자 도메인 연결은 Cloudflare 계정에서 진행해야 합니다.

Workers 환경으로 미리 보거나 배포 설정을 검사할 때는 아래 명령을 사용합니다. 직접 배포하는 `npm run deploy`에는 Cloudflare 인증이 필요합니다.

```sh
npm ci
npm run deploy:check
npm run preview:worker
```

Workers 미리보기 주소는 `http://127.0.0.1:8787`입니다. `deploy:check`는 실제 공개 배포를 하지 않습니다.

## 수정할 파일

- `public/index.html`: 화면 구성, 순서대로 전환할 다섯 문구, 제목·설명
- `public/styles.css`: 색상·크기·반응형 레이아웃
- `public/app.js`: 문구 유지 시간(2400ms), 전환 시간(650ms), 점 애니메이션 간격(550 / 1.5 ≈ 366.7ms)
- `public/favicon.svg`: 브라우저 탭 아이콘
- `public/fonts/sb-aggro-light.ttf`: 사용자가 제공한 SB 어그로 L 폰트. 중앙 전환 문구 및 크기·점수·GG 표시에 웹폰트로 적용
- `public/_headers`: Cloudflare Workers Static Assets 응답 헤더와 캐시 재검증
- `wrangler.jsonc`: Workers 이름, 호환성 날짜, 정적 파일 경로
- `public/game-physics.mjs`: 공의 중력·반사·타격 방향·점수 판정
- `public/ball-shapes.mjs`: 원·하트·별의 모양 및 생성 확률
- `public/game.js`, `public/game.css`: 공 크기 드래그, 커서 점수·색 반전, 불투명한 별 모양 클릭 효과·10점 폭죽

첫 번째 문구부터 제공된 순서대로 계속 전환됩니다. 문구를 2.4초간 보여 준 뒤, 0.65초 동안 이전 문구는 아래로 내려가고 다음 문구는 위에서 들어옵니다. 다섯 번째 다음에는 첫 번째 문구로 이어집니다. 전환 시간 변경 시 `styles.css`의 `message-enter`·`message-leave` 애니메이션 시간도 함께 바꾸세요.

모든 문구가 같은 공간을 공유해 전환할 때 화면이 위아래로 흔들리지 않습니다. 뒤의 점은 `. → .. → ...`로 계속 바뀝니다. 운영체제의 동작 줄이기 설정에서는 현재 문구와 `...`를 고정 표시합니다. JavaScript를 끄면 첫 번째 문구가 표시됩니다. 하단 가운데에는 일반 텍스트 이메일 `power0802m@naver.com`과 사이트 버전이 표시됩니다.

## 사이트 버전

사이트 수정 요청 하나를 완료할 때마다 `npm run version:bump`를 한 번 실행합니다. `package.json`, `package-lock.json`, 하단 표시의 마지막 숫자가 함께 올라갑니다(예: v0.0.1 → v0.0.2). 중간 저장이나 미리보기 열기에는 버전을 올리지 않습니다. 이후 작업에서도 이 규칙을 따르도록 `AGENTS.md`에 기록했습니다. 배포할 때는 수정한 `public`, `package.json`, `package-lock.json`을 함께 커밋하세요.

## 공 살려두기

빈 곳을 누른 채 드래그하면 윤곽선 공의 크기를 정할 수 있습니다. 누른 지점이 중심이며 드래그 거리가 반지름입니다. 커서 오른쪽 위에는 `60px`처럼 실제 지름이 표시됩니다. 지름은 16~320px이며 작은 화면에서는 상한이 줄어듭니다. 드래그 없이 짧게 클릭·탭하면 기본 지름 36px을 사용합니다.

손을 놓으면 공이 채워져 위로 튀고 크기 표시가 `0`점으로 전환됩니다. 공은 겹치는 부분의 색을 반전시켜 밝은 배경 위에서는 어둡고, 어두운 글자 위에서는 그 부분만 밝게 보입니다. 떨어지는 공을 다시 클릭할 때마다 1점씩 올라갑니다. 공의 왼쪽을 누르면 오른쪽 위로, 오른쪽을 누르면 왼쪽 위로 튕깁니다. 중앙을 누르면 수직으로 올라갑니다.

새 공은 원 80%·하트 10%·별 10% 확률로 생성됩니다. 모양은 드래그를 시작할 때 한 번 정해지고 미리보기부터 게임 종료까지 유지됩니다. 하트와 별은 비행 중 회전하며, 클릭한 쪽과 벽 충돌에 따라 회전 방향·속도가 달라집니다.

점수·GG는 SB 어그로 L 폰트와 색 반전을 사용하며 검정 공과 겹치면 흰색으로 보입니다. 클릭할 때는 불투명한 8방향 선이 바깥으로 튀면서 짧아집니다. 10점마다 24개의 더 길고 선명한 선이 두 차례에 걸쳐 퍼지는 폭죽이 약 1.05초간 표시됩니다. 공을 놓치면 점수가 `GG`로 바뀌었다가 사라집니다. 빈 곳을 다시 드래그해 새 게임을 시작합니다. 크기 지정 중 Escape, 포인터 취소, 창의 포커스 상실은 미완성 공을 취소합니다. 기존 링크는 게임 클릭에서 제외되며 별도 메뉴·패널·게임 화면은 없습니다.

동작 줄이기 설정에서는 선 이펙트·폭죽과 점수 슬라이드를 생략합니다. 탭을 숨기면 공의 운동이 일시정지됩니다. 터치 기기에서는 한 손가락 드래그로 크기를 정하며 두 손가락 확대는 유지합니다. 점수는 마지막 터치 위치의 오른쪽 위에 표시됩니다.

물리와 점수 테스트는 패키지 설치 없이 `npm test`로 실행합니다.

## 공식 문서

- [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Workers Builds 설정](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
- [Workers 사용자 도메인](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
