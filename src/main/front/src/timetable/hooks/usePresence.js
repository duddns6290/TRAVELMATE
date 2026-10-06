import { useEffect, useRef, useState } from "react";

const SEND_INTERVAL_MS = 80;   // 초당 최대 ~12번만 전송
const EXPIRE_MS = 30000;       // 이 시간 동안 소식이 없으면 커서를 지운다 (흐려지는 건 CSS 애니메이션이 처리)

// 노션처럼 다른 사람 커서 표시:
//  - 지도 위: 위도/경도 (창 크기가 달라도 같은 지점)
//  - 타임라인: 마우스를 올린 장소 id
const usePresence = ({ userId, sendCursor }) => {
    const [cursors, setCursors] = useState({}); // { [userId]: { lat, lng, hoverPlaceId, ts } }

    const mine = useRef({ lat: null, lng: null, hoverPlaceId: null });
    const timerRef = useRef(null);
    const lastSentRef = useRef(0);
    const sendRef = useRef(sendCursor);
    sendRef.current = sendCursor;

    const flush = () => {
        timerRef.current = null;
        lastSentRef.current = Date.now();
        sendRef.current?.({ userId, ...mine.current });
    };

    // 마지막 상태만 보내는 throttle (중간 값은 버린다)
    const schedule = () => {
        if (!userId || timerRef.current) return;
        const wait = Math.max(0, SEND_INTERVAL_MS - (Date.now() - lastSentRef.current));
        timerRef.current = setTimeout(flush, wait);
    };

    const reportMap = (latlng) => {
        mine.current = { ...mine.current, lat: latlng?.lat ?? null, lng: latlng?.lng ?? null };
        schedule();
    };

    const reportHover = (placeId) => {
        const next = placeId ?? null;
        if (mine.current.hoverPlaceId === next) return;
        mine.current = { ...mine.current, hoverPlaceId: next };
        schedule();
    };

    const handleCursorMessage = (msg) => {
        if (!msg?.userId || msg.userId === userId) return;
        setCursors(prev => {
            if (msg.leave) {
                if (!prev[msg.userId]) return prev;
                const next = { ...prev };
                delete next[msg.userId];
                return next;
            }
            return {
                ...prev,
                [msg.userId]: {
                    lat: msg.lat ?? null,
                    lng: msg.lng ?? null,
                    hoverPlaceId: msg.hoverPlaceId != null ? String(msg.hoverPlaceId) : null,
                    ts: Date.now(),
                },
            };
        });
    };

    // 오래된 커서 정리
    useEffect(() => {
        const id = setInterval(() => {
            setCursors(prev => {
                const now = Date.now();
                const alive = Object.entries(prev).filter(([, c]) => now - c.ts < EXPIRE_MS);
                return alive.length === Object.keys(prev).length ? prev : Object.fromEntries(alive);
            });
        }, 2000);
        return () => clearInterval(id);
    }, []);

    // 페이지를 떠나면 다른 사람 화면에서 내 커서를 바로 지운다
    useEffect(() => {
        if (!userId) return;
        const leave = () => sendRef.current?.({ userId, leave: true });
        window.addEventListener("beforeunload", leave);
        return () => {
            leave();
            window.removeEventListener("beforeunload", leave);
            clearTimeout(timerRef.current);
        };
    }, [userId]);

    return { cursors, reportMap, reportHover, handleCursorMessage };
};

export default usePresence;
