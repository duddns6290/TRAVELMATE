import React, { useEffect, useState } from "react";
import axios from "axios";
import "./TempList.css";
import { useNavigate } from "react-router-dom";
import { memoColorFor } from "../timetable/utils/memoColor";
import { forgetScrap, getCurrentUserId, getScraps, loadScraps, removeScrap } from "../Map/scrapStore";
import { findRestaurantId } from "../timetable/utils/findRestaurantId";

const LEGACY = "__legacy__"; // 작성자 정보가 없는 예전 스크랩


// 스크랩한 장소 카드 하나: 사진, 이름/주소, 메모(인라인 추가), 타임테이블 등록/삭제
const ScrapCard = ({ place, onRegister, onDelete, canDelete, me }) => {
    const [memos, setMemos] = useState([]);
    const [writing, setWriting] = useState(false);
    const [memoText, setMemoText] = useState("");
    const [registering, setRegistering] = useState(false);
    const [registered, setRegistered] = useState(false);

    useEffect(() => {
        axios.get(`/memos/temp/${place.id}`)
            .then(res => setMemos(res.data || []))
            .catch(() => setMemos([]));
    }, [place.id]);

    const saveMemo = async () => {
        const text = memoText.trim();
        if (!text) return;
        try {
            const res = await axios.post(`/memos/temp/${place.id}/memo`, {
                memoText: text,
                tempId: Number(place.id),
                userId: me, // 사람별 색상 + 사람당 1개 제한
            });
            setMemos(prev => [...prev, res.data]);
            setMemoText("");
            setWriting(false);
        } catch (err) {
            if (err.response?.status === 409) {
                alert("이 장소에는 이미 내 메모가 있어요.");
                return;
            }
            console.error("메모 등록 실패:", err);
            alert("메모 저장 중 오류가 발생했습니다.");
        }
    };

    const deleteMemo = async (memo) => {
        if (!window.confirm("내 메모를 삭제할까요?")) return;
        try {
            await axios.delete(`/memos/${memo.memoId}`, { params: { userId: me } });
            setMemos(prev => prev.filter(m => m.memoId !== memo.memoId));
        } catch (err) {
            console.error("메모 삭제 실패:", err);
            alert(err.response?.status === 403 ? "본인이 작성한 메모만 삭제할 수 있어요." : "메모 삭제 중 오류가 발생했습니다.");
        }
    };

    const handleRegister = async () => {
        if (registering || registered) return;
        setRegistering(true);
        const ok = await onRegister(place);
        setRegistering(false);
        if (ok) setRegistered(true);
    };

    return (
        <div className="scrap-card">
            <div className="scrap-card-main">
                {place.image ? (
                    <img className="scrap-thumb" src={place.image} alt="" referrerPolicy="no-referrer" />
                ) : (
                    <div className="scrap-thumb scrap-thumb-empty">📍</div>
                )}
                <div className="scrap-info">
                    <div className="scrap-name">{place.name}</div>
                    <div className="scrap-address">{place.address}</div>
                </div>
                {/* 본인 스크랩만 삭제 가능 */}
                {canDelete && (
                    <button className="scrap-delete" title="스크랩 삭제" onClick={() => onDelete(place)}>×</button>
                )}
            </div>

            {/* 메모: 스크랩한 사람과 상관없이 누구나 1개씩, 작성자 색으로 표시 */}
            {memos.length > 0 && (
                <div className="scrap-memos">
                    {memos.map(m => {
                        const color = memoColorFor(m.userId || null);
                        return (
                            <div
                                key={m.memoId}
                                className="scrap-memo"
                                style={{ background: color.bg, borderLeftColor: color.accent, color: color.text }}
                            >
                                <span className="scrap-memo-author" style={{ color: color.accent }}>
                                    {m.userId ? (m.userId === me ? "나" : m.userId) : "이전 메모"}
                                    {/* 본인 메모(또는 작성자 없는 예전 메모)만 삭제 가능 */}
                                    {(!m.userId || m.userId === me) && (
                                        <button
                                            className="scrap-memo-delete"
                                            title="메모 삭제"
                                            onClick={() => deleteMemo(m)}
                                        >×</button>
                                    )}
                                </span>
                                {m.memoText || m.memoTitle}
                            </div>
                        );
                    })}
                </div>
            )}

            {writing ? (
                <div
                    className="scrap-memo-form"
                    style={{ borderColor: memoColorFor(me).accent, background: memoColorFor(me).bg }}
                >
                    <textarea
                        autoFocus
                        rows={2}
                        placeholder="이 장소에 대한 메모"
                        value={memoText}
                        onChange={e => setMemoText(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === "Escape") setWriting(false);
                            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) saveMemo();
                        }}
                    />
                    <div className="scrap-memo-actions">
                        <button className="scrap-btn-text" onClick={() => setWriting(false)}>취소</button>
                        <button
                            className="scrap-btn-small"
                            style={{ background: memoColorFor(me).accent }}
                            disabled={!memoText.trim()}
                            onClick={saveMemo}
                        >저장</button>
                    </div>
                </div>
            ) : null}

            <div className="scrap-actions">
                {!writing && !memos.some(m => me && m.userId === me) && (
                    <button className="scrap-btn-ghost" onClick={() => setWriting(true)}>✎ 메모</button>
                )}
                <button
                    className={`scrap-btn-primary ${registered ? "is-done" : ""}`}
                    onClick={handleRegister}
                    disabled={registering || registered}
                >
                    {registered ? "✓ 등록됨" : registering ? "등록 중..." : "타임테이블 등록"}
                </button>
            </div>
        </div>
    );
};

// 타임테이블 오른쪽에서 열리는 스크랩한 장소 패널
const TempList = () => {
    const [places, setPlaces] = useState(null);
    const [members, setMembers] = useState([]);
    const me = getCurrentUserId();
    const [activeUser, setActiveUser] = useState(me || LEGACY);
    const navigate = useNavigate();
    const travelId = sessionStorage.getItem("selectedTravelId");

    useEffect(() => {
        if (!travelId) return;
        // 공유 스크랩 스토어: 내 변경과 다른 사람의 변경(소켓)이 모두 "scrap-changed"로 들어온다
        const sync = () => setPlaces([...getScraps()]);
        window.addEventListener("scrap-changed", sync);
        loadScraps(travelId).catch(err => {
            console.error("스크랩한 장소 불러오기 실패:", err);
            setPlaces([]);
        });
        // 여행 참여자: 스크랩이 없어도 탭이 보이도록
        axios.get(`/traveluser/${travelId}`)
            .then(res => setMembers((res.data || []).map(u => u.userId)))
            .catch(() => setMembers([]));
        return () => window.removeEventListener("scrap-changed", sync);
    }, [travelId]);

    // 사람별 탭: 나 → 다른 참여자 → (있으면) 예전 스크랩
    const byUser = {};
    (places || []).forEach(p => {
        const key = p.userId || LEGACY;
        (byUser[key] = byUser[key] || []).push(p);
    });
    const tabs = [
        ...(me ? [me] : []),
        ...[...new Set([...members, ...Object.keys(byUser)])].filter(u => u !== me && u !== LEGACY),
        ...(byUser[LEGACY] ? [LEGACY] : []),
    ];
    const current = tabs.includes(activeUser) ? activeUser : tabs[0];
    const visible = byUser[current] || [];
    const tabLabel = (u) => (u === LEGACY ? "이전 스크랩" : u === me ? "나" : u);

    const close = () => navigate(-1);

    // 패널을 지도 영역 안에만 띄운다: 상단바를 덮지 않고, 메모/상세 패널이 열려 지도가 밀려도 따라간다.
    const [area, setArea] = useState(null);
    useEffect(() => {
        const measure = () => {
            const mapPanel = document.querySelector('[class*="Timetable_mapPanel__"]');
            if (!mapPanel) return;
            const r = mapPanel.getBoundingClientRect();
            setArea({ top: r.top, left: r.left, right: window.innerWidth - r.right, bottom: window.innerHeight - r.bottom });
        };
        measure();
        const mapPanel = document.querySelector('[class*="Timetable_mapPanel__"]');
        const observer = mapPanel && typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
        observer?.observe(mapPanel);
        window.addEventListener("resize", measure);
        return () => {
            observer?.disconnect();
            window.removeEventListener("resize", measure);
        };
    }, []);
    const GAP = 12;
    const panelStyle = area && {
        top: area.top + GAP,
        right: area.right + GAP,
        bottom: area.bottom + GAP,
        maxWidth: `calc(100vw - ${area.left + area.right + GAP * 2}px)`,
    };

    useEffect(() => {
        const onKey = (e) => e.key === "Escape" && close();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleRegister = async (place) => {
        if (!window.registerToTimetable) {
            alert("지도가 아직 준비되지 않았습니다.");
            return false;
        }
        // 1. 타임테이블에 등록 (성공하면 새 장소 id). 식당 id가 없던 예전 스크랩은 좌표·이름으로 찾아서 넘긴다
        const restaurantId = place.restaurantId
            || await findRestaurantId({ name: place.name, lat: place.latitude, lon: place.longitude });
        const placeId = await window.registerToTimetable(
            place.latitude,
            place.longitude,
            place.name,
            place.address,
            restaurantId || null,
            place.image || ""
        );
        if (!placeId) return false;

        // 2. 스크랩 메모를 새 장소로 옮기고 스크랩은 삭제 (서버에서 한 번에 처리)
        try {
            const res = await axios.post(`/tempplace/${place.id}/move-to-place`, null, { params: { placeId } });
            const moved = (res.data || []).map(m => {
                const contents = [];
                if (m.memoText) contents.push({ type: "text", content: m.memoText });
                if (m.memoExtraLink) contents.push({ type: "link", content: m.memoExtraLink });
                if (m.memoImage) contents.push({ type: "image", content: m.memoImage });
                return { memoId: m.memoId, contents, userId: m.userId || null };
            });

            // 3. 옮겨진 메모를 타임테이블에 바로 보이게 + 다른 사용자에게 전파
            if (moved.length) {
                const selectedDay = Number(sessionStorage.getItem("selectedDay")) || 1;
                window.applyAndBroadcast?.("MEMO_UPDATE", String(placeId), { selectedDay, memos: moved });
            }
            window.dispatchEvent(new Event("refresh-timetable"));

            // 4. 스크랩 목록에서 제거 (다른 사용자에게도)
            forgetScrap(place);
        } catch (err) {
            // 등록 자체는 됐으므로 스크랩/메모 이동 실패만 알린다
            console.error("스크랩 메모 이동 실패:", err);
            alert("타임테이블에는 등록됐지만 메모를 옮기지 못했습니다.");
        }
        return true;
    };

    const handleDelete = async (place) => {
        if (!window.confirm(`'${place.name}' 스크랩을 삭제할까요?`)) return;
        try {
            await removeScrap(place); // 목록 갱신 + 다른 사용자에게 전파
        } catch (err) {
            console.error("삭제 실패:", err);
            alert("삭제 중 오류가 발생했습니다.");
        }
    };

    return (
        <div className="scrap-panel" style={panelStyle || undefined}>
            <div className="scrap-header">
                <div>
                    <h2>스크랩한 장소</h2>
                    {places && <span className="scrap-count">전체 {places.length}곳</span>}
                </div>
                <button className="scrap-close" onClick={close} aria-label="닫기">×</button>
            </div>

            {tabs.length > 0 && (
                <div className="scrap-tabs">
                    {tabs.map(u => {
                        const color = memoColorFor(u === LEGACY ? null : u);
                        const active = u === current;
                        return (
                            <button
                                key={u}
                                className={`scrap-tab ${active ? "is-active" : ""}`}
                                style={active ? { background: color.accent, borderColor: color.accent } : { borderColor: color.accent, color: color.text }}
                                onClick={() => setActiveUser(u)}
                            >
                                {tabLabel(u)}
                                <span className="scrap-tab-count">{(byUser[u] || []).length}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="scrap-list">
                {places === null ? (
                    <div className="scrap-empty">불러오는 중...</div>
                ) : visible.length === 0 ? (
                    <div className="scrap-empty">
                        <div className="scrap-empty-icon">☆</div>
                        {current === me ? (
                            <>
                                아직 스크랩한 장소가 없어요.
                                <br />
                                지도에서 장소를 누르고 "＋ 스크랩"을 눌러 저장해보세요.
                            </>
                        ) : (
                            <>{tabLabel(current)}님이 스크랩한 장소가 없어요.</>
                        )}
                    </div>
                ) : (
                    visible.map(place => (
                        <ScrapCard
                            key={place.id}
                            place={place}
                            onRegister={handleRegister}
                            onDelete={handleDelete}
                            canDelete={!place.userId || place.userId === me}
                            me={me}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

export default TempList;
