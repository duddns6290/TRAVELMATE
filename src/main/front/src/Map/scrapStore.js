import axios from "axios";

// 스크랩 공유 상태. 지도 핀/정보창, 스크랩 패널이 같은 목록을 보고,
// 추가/삭제는 웹소켓(SCRAP_ADD / SCRAP_DELETE)으로 같은 여행의 다른 사용자에게 전파된다.
// 변경될 때마다 window "scrap-changed" 이벤트를 쏜다.

let scraps = [];

const emit = () => window.dispatchEvent(new CustomEvent("scrap-changed"));

// Timetable.js가 노출하는 소켓 전송 함수 (없으면 조용히 무시)
const broadcast = (type, newValue) => window.broadcastTravelEvent?.(type, newValue);

export const getCurrentUserId = () => {
    try {
        const token = localStorage.getItem("accessToken");
        return token ? JSON.parse(atob(token.split(".")[1])).sub : null;
    } catch (e) {
        return null;
    }
};

export const getScraps = () => scraps;

export const loadScraps = async (travelId) => {
    const res = await axios.get(`/tempplace/travel/${travelId}`);
    scraps = res.data || [];
    emit();
    return scraps;
};

// 좌표가 같은(거의 같은) 장소의 스크랩들
export const scrapsAt = (lat, lon) =>
    scraps.filter(s =>
        Math.abs(s.latitude - lat) < 0.0001 &&
        Math.abs(s.longitude - lon) < 0.0001
    );

export const addScrap = async (payload) => {
    const res = await axios.post("/tempplace", payload, {
        headers: { "Content-Type": "application/json" }
    });
    const saved = res.data;
    scraps = [...scraps, saved];
    emit();
    broadcast("SCRAP_ADD", saved);
    return saved;
};

export const removeScrap = async (scrap) => {
    await axios.delete(`/tempplace/${scrap.id}`, { params: { userId: getCurrentUserId() } });
    scraps = scraps.filter(s => s.id !== scrap.id);
    emit();
    broadcast("SCRAP_DELETE", { id: scrap.id });
};

// 서버에서 이미 지워진 스크랩(예: 타임테이블로 옮김)을 목록에서 빼고 다른 사용자에게 알린다
export const forgetScrap = (scrap) => {
    scraps = scraps.filter(s => s.id !== scrap.id);
    emit();
    broadcast("SCRAP_DELETE", { id: scrap.id });
};

// 다른 사용자의 변경 (Timetable.js가 소켓 메시지를 "scrap-remote" 이벤트로 넘겨준다)
window.addEventListener("scrap-remote", (e) => {
    const { type, newValue } = e.detail || {};
    if (!newValue) return;
    if (type === "SCRAP_ADD") {
        if (scraps.some(s => s.id === newValue.id)) return;
        scraps = [...scraps, newValue];
    } else if (type === "SCRAP_DELETE") {
        scraps = scraps.filter(s => s.id !== newValue.id);
    } else {
        return;
    }
    emit();
});
