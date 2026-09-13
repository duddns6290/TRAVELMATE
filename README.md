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
- Spring Security (JWT)
- Spring Data JPA
- MongoDB
- Thymeleaf (PDF 템플릿)
- AWS S3
- OAuth2 (Naver, Kakao)
- WebSocket (실시간 기능)
----
2. 주요 기능

회원 관리
- 로그인 / 로그아웃
- Naver OAuth 로그인
- Kakao OAuth 로그인
- JWT 기반 인증

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

날씨 조회
- 지역별 실시간 날씨 조회 (Weather API)

---

3. 실행 환경

Java Version
- Java 17


4. 환경 변수 설정

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

- JWT
  - JWT_SECRET=

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
6. 트러블슈팅

AWS EC2 배포 후 OAuth2 로그인 실패 (redirect_uri_mismatch)

로컬 환경에서는 정상적으로 동작하던 네이버·카카오 OAuth2 로그인이 AWS EC2 배포 후 실패하는 문제가 있었습니다.

원인
- OAuth2 인증 과정에서 `redirect_uri_mismatch` 오류 발생
- `application.properties`의 Redirect URI가 `http://localhost:8080` 기준으로 설정되어 있었음
- `WebConfig.java`의 `allowedOrigins`가 `http://localhost:3000`만 허용하고 있었음
- 네이버·카카오 개발자 콘솔에도 localhost 기준 Redirect URI만 등록되어 있었음

해결 과정
1. 네이버·카카오 개발자 콘솔에 배포 서버 주소(EC2 퍼블릭 IP 또는 도메인)를 Redirect URI로 추가 등록
2. `application.properties`의 `NAVER_REDIRECT_URI`, `KAKAO_REDIRECT_URI` 값을 배포 서버 주소로 수정
3. `WebConfig.java`의 `allowedOrigins`에 운영 환경의 프론트엔드 주소 추가

배운 점
OAuth2 인증은 애플리케이션 코드뿐만 아니라 외부 인증 서버(개발자 콘솔) 설정과 배포 환경 설정(Redirect URI, CORS)까지 함께 고려해야 합니다. 개발자 콘솔과 설정 파일 양쪽 모두 운영 환경에 맞게 수정해야 정상적으로 동작합니다.

---
5. 기타

- 지역별 날씨 조회 기능 지원
- 여행 계획 PDF 출력 기능 지원
- OAuth 로그인 및 JWT 인증 기반 보안 구조
- AWS S3를 통한 이미지 업로드 지원
- RDB + MongoDB 혼합 구조 사용
