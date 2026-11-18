# GLOSSY (글로시) — 홈페이지

수원 광교 **글로시(GLOSSY)** 의 정적 홈페이지입니다. 빌드 도구 없이 HTML/CSS/JS 만으로 동작하고,
원장님이 직접 문구·사진을 고칠 수 있는 `/admin/` 페이지가 함께 들어 있습니다.

- 대상: 수원 눈썹문신 · 입술·아이라인 반영구 · 잔혼 커버 · 속눈썹펌 · 수강
- 언어: **한국어 / 日本語 / English** (상단 KR·JP·EN 버튼 또는 `?lang=jp`)
- 예약: 한국어 → 카카오톡 채널, 일본어·영어 → LINE

```
glossy-brow/
├─ index.html            한 페이지 (섹션 10개)
├─ styles.css            디자인 (porcelain · espresso · rose clay)
├─ app.js                data/content.json 을 읽어 화면을 채우고 언어 전환
├─ data/content.json     ★ 모든 문구·가격·사진 경로 (관리자 페이지가 이 파일을 고칩니다)
├─ assets/
│  ├─ hero.jpg · about.jpg · space.jpg · og-image.jpg
│  ├─ gallery/           시술 사진 9장
│  ├─ reels/             인스타그램 릴스 4편 (mp4 + 표지 jpg)
│  └─ fonts/             self-host 웹폰트(서브셋) + fonts.css
├─ admin/                원장님용 편집 페이지 (noindex)
├─ tools/verify.py       자동 검증 (로컬 전용, 배포 제외)
├─ tools/build-fonts.py  문구를 크게 바꾼 뒤 폰트 서브셋 재생성 (로컬 전용)
├─ tools/make-og-image.py OG 이미지 재생성 (로컬 전용)
├─ notes/source-data.md  수집한 실제 자료와 출처 (로컬 전용, 배포 제외)
├─ preview/              검증 스크린샷 (로컬 전용, 배포 제외)
├─ robots.txt (Disallow: /admin/) · sitemap.xml · .nojekyll
```

---

## 1. 로컬에서 보기

```bash
cd voi-creative-studio/glossy-brow
python3 -m http.server 8080
# http://127.0.0.1:8080/
```

`data/content.json` 을 fetch 하므로 `file://` 로 열면 문구가 채워지지 않습니다. 반드시 서버로 여세요.

## 2. 검증

```bash
python3 voi-creative-studio/glossy-brow/tools/verify.py
```

로컬 서버를 스스로 띄우고 다음을 확인합니다 (**2026-11-19 기준 71/71 통과**).

- 데스크톱 1440px · 모바일 390px 레이아웃, 가로 스크롤 없음, 이미지 전부 로드
- 로컬 폰트 3종(Noto Serif KR · Noto Sans KR · Cormorant Garamond) 로드
- 릴스 4편: 파일·표지 연결, 720×1280 재생, 자동 넘김, 이전/다음, 일시정지
- 갤러리 라이트박스 열기·다음·닫기
- 언어 전환 KR→JP→EN (문구 변경 + 예약 버튼이 LINE으로)
- 모바일 메뉴 열기
- `/admin/`: noindex, 게이트 → 토큰 없이 둘러보기 → 16개 영역 렌더, JSON 검증
- 콘솔 에러 0 · 페이지 예외 0 · 실패 요청 0 · 4xx/5xx 0

관리자 페이지의 **저장 경로**는 GitHub API를 목(mock)으로 대체해 따로 검증합니다 (실제 저장소에 쓰지 않음).

```bash
python3 voi-creative-studio/glossy-brow/tools/test-admin-save.py   # 12/12 통과
```

- 토큰 검증 → 문구 수정 → `PUT data/content.json` → 저장된 JSON에 반영 → 홈페이지 반영 확인까지

결과: `preview/*.png`, `preview/verify-report.json`
- `01-desktop.png` · `02-mobile.png` · `03-reels.png` · `06-admin.png` (+ 섹션별 캡처)

## 3. GitHub Pages 배포 (완료)

- 저장소: https://github.com/snow196830-stack/glossybrow (public)
- 라이브: **https://snow196830-stack.github.io/glossybrow/** · 관리자 `/glossybrow/admin/`
- 설정: Pages → Deploy from a branch → `main` / `/ (root)`, HTTPS 적용됨

문구·사진을 고친 뒤 반영하는 방법:

```bash
# 1) 로컬 원본(voi-creative-studio/glossy-brow)에서 수정하고 검증
python3 voi-creative-studio/glossy-brow/tools/verify.py
# 2) 배포용 폴더로 동기화 (notes/·preview/·tools/ 제외)
python3 - <<'EOF'
import shutil, os
src='voi-creative-studio/glossy-brow'; dst='voi-creative-studio/glossy-brow-deploy'
for name in os.listdir(src):
    if name in ('notes','preview','tools','.git'): continue
    s, d = os.path.join(src,name), os.path.join(dst,name)
    shutil.rmtree(d, ignore_errors=True) if os.path.isdir(d) else (os.path.exists(d) and os.remove(d))
    shutil.copytree(s, d) if os.path.isdir(s) else shutil.copy2(s, d)
EOF
# 3) 커밋·푸시 → 30~60초 뒤 사이트 반영
cd voi-creative-studio/glossy-brow-deploy
git add -A && git commit -m "문구 수정" && git push
```

원장님이 `/admin/` 에서 저장하면 위 과정 없이 GitHub 에 바로 커밋됩니다.

- `.nojekyll` 포함되어 있어 그대로 정적 파일로 서빙됩니다.
- `robots.txt` 에서 `/admin/` 을 막고, 관리자 페이지에는 `<meta name="robots" content="noindex, nofollow">` 와 `admin/_headers`(`X-Robots-Tag`)가 들어 있습니다.
- 배포 후 `sitemap.xml` 의 URL, `index.html` 의 `og:image` 절대경로(현재 상대경로)를 실제 주소로 바꾸면 미리보기가 더 정확해집니다.
- 커스텀 도메인을 붙이면 `sitemap.xml` · `robots.txt` · OG 태그의 주소도 함께 바꿔 주세요.

## 4. 원장님용 관리자 페이지 (`/admin/`)

`https://<사이트>/admin/` 에서 문구·사진·가격을 직접 고칠 수 있습니다.

1. **GitHub 토큰 연결** — GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → 저장소 `snow196830-stack/glossybrow` 선택 → Permissions: **Contents = Read and write**.
2. 토큰을 붙여넣고 **연결하기** (원하면 4자리 PIN으로 잠글 수 있습니다. 토큰은 그 브라우저에만 저장).
3. 문구를 고치고 **저장 및 홈페이지 반영** → GitHub 에 커밋되고 30~60초 뒤 사이트에 반영됩니다.
4. 언어 버튼(한국어·日本語·English)을 바꾸면 그 언어의 문구를 편집합니다. 비우면 한국어가 표시됩니다.

편집할 수 있는 영역 16개:

| # | 영역 | 내용 |
|---|---|---|
| 1 | 기본·공지 | 브랜드명, 상단 띠 공지 |
| 2 | 보이는 영역 | 섹션 11개 켜기/끄기 |
| 3 | 첫 화면 | 큰 제목·소개·사진·배지, 숫자 4개 |
| 4 | 브랜드 소개 | 소개 문단, 특징 4개, 인용 |
| 5 | 시술·가격 | 그룹(반영구/잔혼 커버/속눈썹펌)별 항목·금액 |
| 6 | 갤러리 | 사진·설명·원본 링크 |
| 7 | 릴스 | 영상·표지 파일 경로, 제목 |
| 8 | 공간 소개 | 시술실 사진, 안내 3개 |
| 9 | 수강 | 정규·원데이 안내 |
| 10 | 일본 고객 | LINE 안내, 방일 일정 |
| 11 | 리뷰 | 평점·리뷰 수·키워드·인용 |
| 12 | 예약 | 3단계, 주의 문구, 쿠폰 안내 |
| 13 | FAQ | 질문/답 |
| 14 | 오시는 길 | 주소·시간·전화·주차 |
| 15 | 링크 | 카카오톡·네이버·인스타그램·LINE·오픈채팅 주소 |
| 16 | 푸터 | 저작권·출처 안내 |

사진은 **사진 선택**으로 고르면 브라우저에서 가로 900px(첫 화면·공간은 1100~1200px)로 줄여 저장소에 올라갑니다.

## 5. 문구를 크게 바꿨을 때

```bash
python3 voi-creative-studio/glossy-brow/tools/build-fonts.py   # 사용한 글자만 폰트로 다시 굽기
python3 voi-creative-studio/glossy-brow/tools/make-og-image.py # OG 이미지 다시 만들기
python3 voi-creative-studio/glossy-brow/tools/verify.py        # 검증 + 스크린샷
```

폰트는 Google Fonts 원본(Noto CJK `SubsetOTF`)을 받아 `pyftsubset`(brotli 필요)으로 서브셋합니다.
`pip install brotli fonttools` 가 필요합니다.

## 6. 사실 근거

가격·전화번호·주소 등 모든 값의 출처와, 확인하지 못해 비워 둔 항목은
로컬 `notes/source-data.md`(배포 제외)에 정리되어 있습니다.

특히 다음은 **공개 자료에 없어서 넣지 않았습니다**: 사업자등록번호, 대표자명, 반영구 시술 금액,
시술 소요 시간·유지 기간. 확인되는 대로 `/admin/` 에서 채우면 됩니다.
