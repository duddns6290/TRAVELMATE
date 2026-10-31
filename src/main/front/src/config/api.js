// 백엔드 주소. CRA는 process.env.REACT_APP_* 를 빌드 시점에 코드로 치환하므로, 배포 빌드 후에는 바꿀 수 없다.
// - 로컬 개발(npm start): REACT_APP_API_BASE가 없으면 http://localhost:8080
// - 배포 빌드(npm run build): REACT_APP_API_BASE가 없으면 "" → 같은 출처 상대 경로(/user, /ws ...)를 Nginx가 백엔드로 프록시
export const API_BASE = (
    process.env.REACT_APP_API_BASE ??
    (process.env.NODE_ENV === "development" ? "http://localhost:8080" : "")
).replace(/\/+$/, "");
