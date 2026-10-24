## TravelMate

React + Spring Boot 기반의 여행 일정 관리 및 장소 공유 웹 애플리케이션입니다.

TravelMate는 여행 계획을 친구와 함께 세우고, 장소를 저장하고, 친구와 공유하며,
지역별 날씨를 조회하고, 여행 일정을 PDF로 생성할 수 있는 서비스입니다.

----
1. 기술 스택

Frontend
- React
- Axios
- React Router
- .env 환경변수 사용

Backend
- Java 17
- Spring Boot
- Spring Security (JWT, Refresh Token, 메서드 보안)
- Spring Data JPA
- MongoDB
- Thymeleaf (PDF 템플릿)
- AWS S3
- OAuth2 (Naver, Kakao)
- WebSocket (실시간 기능)
----
2. 주요 기능

회원 관리
- 아이디/비밀번호 로그인 (BCrypt 암호화)
- Naver OAuth 로그인
- Kakao OAuth 로그인
- JWT 기반 인증 + Refresh Token 자동 재발급
- 로그아웃 (Refresh Token 폐기)

메모 관리
- 메모 등록
- 메모 수정
- 메모 삭제
- 메모 조회

지도 관리
- 주소 검색 (Google Places API)
- 카테고리별 장소 조회
- 지도 화면 내 조회
- 시나리오 합치기

저장한 장소 관리
- 장소 등록
- 장소 삭제
- 장소 조회
- 장소 공유
- 친구 초대

친구 관리
- 친구 검색
- 친구 추가
- 친구 제거

여행 관리
- 여행 등록
- 여행 수정 (이름, 기간 등)
- 여행 삭제
- 여행 조회
- 여행 계획 PDF 생성
- 여행별 참여자 권한 (HOST / GUEST_WRITE / GUEST_READ)

날씨 조회
- 지역별 실시간 날씨 조회 (Weather API)

---
3. 인증 · 권한 구조

토큰 종류

| 토큰 | 유효 기간 | 전달 방식 | 용도 |
|---|---|---|---|
| 로그인 토큰 (Access) | 30분 | 응답 body → localStorage, `Authorization: Bearer` 헤더 | 마이페이지 기능 (여행 목록, 친구, 여행 수정·삭제, PDF) |
| 여행 토큰 (Access) | 1시간 | `/auth/switch-travel` 응답 → localStorage | 일정 화면 안의 기능 (장소, 스크랩 장소). 토큰에 travelId가 들어 있음 |
| Refresh Token | 7일 | HttpOnly 쿠키 (`Path=/auth`) | Access Token 재발급 전용. API 인증에는 쓸 수 없음 |

로그인 흐름
1. OAuth 또는 아이디/비밀번호로 로그인하면 Access Token(응답)과 Refresh Token(쿠키)을 받는다.
2. 일정 화면에 들어갈 때 `/auth/switch-travel`로 그 여행의 토큰을 받는다. 참여자가 아니면 403이고 안내 화면이 뜬다.
3. Access Token이 만료돼 401이 오면 프론트(axios 인터셉터)가 `/auth/refresh`로 재발급받아 원래 요청을 다시 보낸다.
4. 로그아웃하면 `/auth/logout`으로 서버의 Refresh Token을 폐기하고 쿠키를 지운다.

Refresh Token 보안
- DB에는 원문이 아니라 SHA-256 해시만 저장한다 (`refresh_token` 테이블).
- 재발급할 때마다 쓴 토큰은 버리고 새 토큰을 준다 (rotation).
- 이미 쓴 토큰이 다시 들어오면 탈취로 보고 그 사용자의 Refresh Token을 모두 폐기한다.

API 접근 권한
- 로그인 없이 열린 API: 정적 리소스, OAuth 로그인, `/user/login`, `/auth/refresh`, `/auth/logout`, 웹소켓, 날씨, 가게 정보
- 그 외 모든 API는 JWT가 필요하다 (없으면 401).
- 여행별 권한은 컨트롤러의 `@PreAuthorize`에서 `TravelAccessChecker`로 검사한다 (권한이 없으면 403).

| 기능 | 조건 |
|---|---|
| 장소, 스크랩 장소 | 그 여행의 여행 토큰 + 현재 참여자 |
| 참여자 목록 조회, PDF 내보내기 | 참여자 |
| 여행 수정·삭제, 참여자 권한 변경·추가·삭제 | 호스트 |
| 여행 목록, 친구 API | 본인 |

- 토큰이 유효한 동안 여행에서 빠질 수도 있으므로 참여 여부는 요청마다 DB로 다시 확인한다.
- 여행을 만들면 호스트는 항상 로그인한 사용자로 정해진다.

비밀번호
- BCrypt 해시로 저장·비교한다.
- 예전에 평문으로 저장된 비밀번호는 그 사용자가 로그인에 성공할 때 해시로 바뀐다.
- 비밀번호는 응답 JSON에 포함되지 않는다.

---
4. 실행 환경

Java Version
- Java 17

---
5. 환경 변수 설정

Frontend (.env)

src/main/front/.env 파일 생성

REACT_APP_API_BASE= [백엔드 서버 주소]

주의사항
- 반드시 REACT_APP_ prefix를 사용해야 React에서 인식됩니다.

---

Backend (.env)

프로젝트 루트 또는 backend 디렉토리에 .env 파일 생성

- DB (로컬)
    - DB_URL=
    - DB_USERNAME=
    - DB_PASSWORD=

- Naver OAuth
  - NAVER_CLIENT_ID=
  -  NAVER_CLIENT_SECRET=
  - NAVER_REDIRECT_URI=
  - NAVER_SCOPE=

- Kakao OAuth
  - KAKAO_CLIENT_ID=
  - KAKAO_CLIENT_SECRET=
  - KAKAO_REDIRECT_URI=
  - KAKAO_SCOPE=

- CORS
  - CORS_ALLOWED_ORIGINS=
  - Refresh Token 쿠키를 주고받기 때문에 `*`는 쓸 수 없고, 프론트 주소를 정확히 적어야 합니다.

- JWT
  - JWT_SECRET=
  - HS256 서명에 쓰므로 32자 이상으로 설정합니다.

- AWS S3
  - AWS_ACCESS_KEY=
  - AWS_SECRET_KEY=
  - AWS_REGION=
  - AWS_S3_BUCKET=

- MongoDB
  - SPRING_DATA_MONGODB_URI=

- API Keys
  - YOUTUBE_API_KEY=
  - SK_API_KEY=
  - TOUR_API_KEY=
  - GOOGLE_PLACES_API_KEY=
  - WEATHER_API_KEY=

- PDF 템플릿 경로 (배포 시 사용)
  - THYMELEAF_TEMPLATE_PREFIX=

---
6. 테스트

DB 없이 실행되는 단위·보안 테스트

```bash
./gradlew test --tests 'org.capstone.token.*' --tests 'org.capstone.service.*' --tests 'org.capstone.controller.ApiSecurityTest'
```

| 테스트 | 내용 |
|---|---|
| `UserServicePasswordTest` | BCrypt 비교, 평문 비밀번호 자동 전환 |
| `RefreshTokenServiceTest` | Refresh Token 해시 저장, rotation, 재사용 감지 시 전체 폐기 |
| `TokenProviderTest` | 토큰 종류 구분, 위조·만료 토큰 거부 |
| `RefreshTokenCookieTest` | 쿠키 HttpOnly / Path / SameSite / Secure 속성 |
| `TravelAccessCheckerTest` | 여행 토큰·참여자·호스트 검사 |
| `ApiSecurityTest` | 실제 SecurityConfig로 HTTP 요청을 보내 401/403 및 로그인·재발급·로그아웃 흐름 확인 |
| `PlaceOrderServiceTest` | 장소 순서 처리 |

- `Capstone2ApplicationTests`는 전체 애플리케이션을 띄우므로 DB와 .env 설정이 필요합니다.

---
7. 트러블슈팅

7-1. Refresh Token 동시 재발급 충돌

문제
- 일정 화면에서 여러 API가 동시에 401을 받으면, 요청마다 각자 Refresh Token 재발급을 시도
- Rotation으로 이미 폐기된 토큰이 다시 들어오면 재사용(탈취)으로 감지되어, 정상 사용자의 Refresh Token이 모두 폐기될 수 있음

해결
- 진행 중인 재발급 Promise를 공유해 재발급은 한 번만 요청
- 재발급 성공 시 기다리던 요청을 새 Access Token으로 재시도
- `_retried` 플래그와 인증 API(로그인·재발급·로그아웃) 예외 처리로 무한 재시도 방지

---

7-2. JWT 인증 및 여행별 접근 권한 검증

문제
- `permitAll("/**")` 설정으로 보호 API에도 인증이 적용되지 않음
- 여행 참여 여부를 검사하지 않아 travelId만 알면 다른 사용자의 여행 데이터에 접근 가능
- `/auth/switch-travel`이 요청 body의 userId를 신뢰해 다른 사용자 명의의 여행 토큰 발급 가능

해결
- 공개 API 외 JWT 인증 필수화
- `@PreAuthorize`와 `TravelAccessChecker`로 여행별 권한 검증 (참여자 / 호스트 / 본인)
- 사용자 정보는 인증된 JWT에서만 추출하고, 참여 여부는 요청마다 DB에서 재확인
- MockMvc 보안 테스트(`ApiSecurityTest`)로 401/403 응답 검증

---
8. 기타

- 지역별 날씨 조회 기능 지원
- 여행 계획 PDF 출력 기능 지원
- OAuth 로그인 및 JWT + Refresh Token 인증 기반 보안 구조
- 여행별 참여자 권한 기반 API 접근 제어
- AWS S3를 통한 이미지 업로드 지원
- RDB + MongoDB 혼합 구조 사용
