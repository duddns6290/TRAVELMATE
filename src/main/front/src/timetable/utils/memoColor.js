// 메모 작성자별 색상. 같은 userId는 항상 같은 색이 나오도록 문자열 해시로 팔레트를 고른다.
const PALETTE = [
    { bg: "#fff8e6", accent: "#f2c14e", text: "#5a4a1e" }, // 노랑
    { bg: "#e9f2ff", accent: "#5b8def", text: "#1f3a6b" }, // 파랑
    { bg: "#eafaf1", accent: "#3dbb7a", text: "#1c5138" }, // 초록
    { bg: "#fdecef", accent: "#ec6f8a", text: "#6b2334" }, // 분홍
    { bg: "#f3edff", accent: "#9372e8", text: "#3d2a73" }, // 보라
    { bg: "#fff1e8", accent: "#f08a4b", text: "#6b3517" }, // 주황
    { bg: "#e8f8f8", accent: "#34b3b3", text: "#16504f" }, // 청록
];

// 작성자 정보가 없는 기존 메모
const DEFAULT_COLOR = PALETTE[0];

export const memoColorFor = (userId) => {
    if (!userId) return DEFAULT_COLOR;
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = (hash * 31 + userId.charCodeAt(i)) | 0;
    }
    return PALETTE[Math.abs(hash) % PALETTE.length];
};
