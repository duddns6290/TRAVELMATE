import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import styles from "./Timetable.module.css";
import Map from "../Map/Map";
import TimelinePanel from "./components/TimelinePanel";
import MemoPanel from "./components/MemoPanel";
import PlaceDetailPanel from "./components/PlaceDetailPanel";
import TimetableModal from "./components/TimetableModal";
import PlaceRegister from "../Temp/PlaceRegister";
import {
    fetchSchedule,
    handleItemClick,
    useDragHandler
} from "./hooks/useSchedule";
import useMemoHandler from "./hooks/useMemoHandler";
import useMoveTime from "./hooks/useMoveTime";
import useTimeEdit from "./hooks/useTimeEdit";
import useWebSocket from "./hooks/useWebSocket";
import usePresence from "./hooks/usePresence";
import { applySchedulePatch } from "./utils/applySchedulePatch";
import { findRestaurantId } from "./utils/findRestaurantId";

const Timetable = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const [schedule, setSchedule] = useState({});
    const [selectedDay, setSelectedDay] = useState(1);
    const [selectedIndex, setSelectedIndex] = useState(null);
    const [modal, setModal] = useState(null);
    const [activeMode, setActiveMode] = useState(null);
    const [dayPageIndex, setDayPageIndex] = useState(0);
    const [isLoadingRoute, setIsLoadingRoute] = useState(false);
    const [selectedEditIndex, setSelectedEditIndex] = useState(null);
    const [dontShowAgain, setDontShowAgain] = useState(false);
    const [showEditHelp, setShowEditHelp] = useState(() => localStorage.getItem("showEditHelp") !== "false");
    const [showRegisterForm, setShowRegisterForm] = useState(false);
    const daysPerPage = 3;
    const { travelId, period: rawPeriod } = useParams();
    const period = Number(rawPeriod);
    const [lockedPlaces, setLockedPlaces] = useState({});
    const token = localStorage.getItem("accessToken");
    const decoded = token ? JSON.parse(atob(token.split('.')[1])) : null;
    const userId = decoded?.sub;

    const handleSocketMessage = (message) => {
        if (message.type === "PLACE_LOCK") {
            setLockedPlaces(prev => ({ ...prev, [message.placeId]: message.userId }));
        } else if (message.type === "PLACE_UNLOCK") {
            setLockedPlaces(prev => {
                const copy = { ...prev };
                delete copy[message.placeId];
                return copy;
            });
        } else if (message.type === "ORDER_SYNC") {
            // 서버가 확정한 순서. 요청한 본인 포함 모두에게 적용한다 (서버가 기준).
            const day = message.newValue?.selectedDay;
            const order = (message.newValue?.order || []).map(String);
            const mine = new Set((schedule[day] || []).map(item => item.id));
            if (order.length === mine.size && order.every(id => mine.has(id))) {
                setSchedule(prev => applySchedulePatch(prev, message));
            } else {
                // 내 화면과 장소 구성이 다르면(누가 막 추가·삭제) 서버에서 다시 불러온다
                window.dispatchEvent(new Event("refresh-timetable"));
            }
        } else if (message.type === "MAP_PLACE_OPEN" || message.type === "MAP_PLACE_CLOSE") {
            if (message.userId !== userId) {
                window.dispatchEvent(new CustomEvent("map-place-remote", {
                    detail: { type: message.type, userId: message.userId, ...message.newValue }
                }));
            }
        } else if (message.type?.startsWith("SCRAP_")) {
            // 스크랩 변경은 스크랩 스토어(Map/scrapStore.js)로 넘긴다. 내가 보낸 건 이미 반영됨.
            if (message.userId !== userId) {
                window.dispatchEvent(new CustomEvent("scrap-remote", { detail: message }));
            }
        } else if (message.userId !== userId) {
            // 내가 보낸 패치는 이미 로컬에 반영했으므로, 다른 사용자가 보낸 패치만 병합한다.
            setSchedule(prev => applySchedulePatch(prev, message));
        }
    };
    const cursorHandlerRef = useRef(null);
    const { sendLock, sendUnlock, sendMessage, sendCursor } = useWebSocket({
        travelId,
        onMessageReceive: handleSocketMessage,
        onCursorReceive: (msg) => cursorHandlerRef.current?.(msg),
    });

    // 다른 사람 커서 (지도: 위도/경도, 타임라인: 마우스를 올린 장소)
    const { cursors, reportMap, reportHover, handleCursorMessage } = usePresence({ userId, sendCursor });
    cursorHandlerRef.current = handleCursorMessage;
    const hoverByPlace = useMemo(() => {
        const byPlace = {};
        Object.entries(cursors).forEach(([uid, c]) => {
            if (c.hoverPlaceId) (byPlace[c.hoverPlaceId] = byPlace[c.hoverPlaceId] || []).push(uid);
        });
        return byPlace;
    }, [cursors]);

    // 편집 액션 하나를 로컬 상태에 반영하는 동시에 같은 travelId를 보는 다른 사용자에게 전파한다.
    const applyAndBroadcast = (type, placeId, newValue) => {
        setSchedule(prev => applySchedulePatch(prev, { type, placeId, newValue }));
        sendMessage({ type, travelId: Number(travelId), userId, placeId, newValue, timestamp: Date.now() });
    };

    useEffect(() => {
        // Map.js 등 React 트리 밖의 코드(initializeMap.js)에서도 호출할 수 있도록 전역에 노출
        window.applyAndBroadcast = applyAndBroadcast;
        // 일정(schedule)과 무관한 이벤트(스크랩 등)를 같은 여행 사용자에게 전파
        window.broadcastTravelEvent = (type, newValue) =>
            sendMessage({ type, travelId: Number(travelId), userId, placeId: 0, newValue, timestamp: Date.now() });
        return () => {
            delete window.applyAndBroadcast;
            delete window.broadcastTravelEvent;
        };
    }, [travelId, userId]);

    const { handleDragEnd } = useDragHandler(schedule, setSchedule, selectedDay, userId);



    useEffect(() => {
        return () => {
            const place = schedule[selectedDay]?.[selectedEditIndex];
            if (place) sendUnlock({ placeId: place.id, userId });
        };
    }, [selectedEditIndex]);



    // 메모 추가/수정은 메모 패널 안에서 인라인으로 처리한다
    const {
        addMemoInline,
        updateMemoInline,
    } = useMemoHandler({ schedule, setSchedule, selectedDay, selectedIndex, setModal, applyAndBroadcast, userId });

    const { handleSelectTransport, handleMoveTimeDelete } = useMoveTime({
        schedule,
        setSchedule,
        selectedDay,
        setIsLoadingRoute,
        applyAndBroadcast
    });
    const { handleSaveTime, handleTimeDelete } = useTimeEdit({ schedule, setSchedule, selectedDay, applyAndBroadcast, userId });

    const handleDeleteItem = (idx, activeModeArg, scheduleArg, selectedDayArg, setScheduleArg) =>
        handleItemClick(idx, activeModeArg, scheduleArg, selectedDayArg, setScheduleArg, applyAndBroadcast, userId);

    useEffect(() => {
        console.log("useEffect 실행됨", travelId, period);
        console.log("🧭 travelId =", travelId, "period =", period);
        fetchSchedule(travelId, period, setSchedule);

        // 이벤트로 새로고침 처리
        const handleRefresh = () => fetchSchedule(travelId, period, setSchedule);
        window.addEventListener("refresh-timetable", handleRefresh);
        return () => window.removeEventListener("refresh-timetable", handleRefresh);
    }, [travelId, period]);


    const closeEditHelp = () => {
        setModal(null);
        if (dontShowAgain) {
            localStorage.setItem("showEditHelp", "false");
            setShowEditHelp(false);
        }
    };

    const handleSelectForEdit = (index) => {
        const place = schedule[selectedDay]?.[index];
        if (!place || lockedPlaces[place.id]) return;

        sendLock({ placeId: place.id, userId });
        setSelectedEditIndex(index);
    };
    useEffect(() => {
        return () => {
            const place = schedule[selectedDay]?.[selectedEditIndex];
            if (place) sendUnlock({ placeId: place.id, userId });
        };
    }, [selectedEditIndex]);

    // 같은 장소의 메모를 다시 누르면 닫힌다. 메모와 상세 패널은 한 번에 하나만 연다.
    const toggleMemoPanel = (index) => {
        if (modal === "memo" && selectedIndex === index) {
            setModal(null);
            return;
        }
        setDetailPlaceId(null);
        setSelectedIndex(index);
        setModal("memo");
    };

    // 장소 상세 패널 (지도 정보창 "상세 보기", 타임라인 장소 이름 클릭). 같은 장소를 다시 열면 닫힌다.
    const [detailPlaceId, setDetailPlaceId] = useState(null);
    // fallback: { name, latitude, longitude } — 상세 id가 없는 장소(스크랩에서 옮긴 장소 등)는 좌표·이름으로 찾아본다
    const openPlaceDetail = async (placeIdArg, fallback) => {
        let placeId = placeIdArg && placeIdArg !== "google" ? placeIdArg : null;
        if (!placeId && fallback) {
            placeId = await findRestaurantId({ name: fallback.name, lat: fallback.latitude, lon: fallback.longitude });
        }
        if (!placeId) {
            alert("상세 정보를 불러오지 못하는 장소입니다.");
            return;
        }
        if (modal === "memo") setModal(null);
        setDetailPlaceId(prev => (prev === placeId ? null : placeId));
    };

    useEffect(() => {
        // 지도 정보창(React 밖에서 만든 DOM)에서 호출할 수 있도록 전역에 노출
        window.openPlaceDetail = openPlaceDetail;
        return () => { delete window.openPlaceDetail; };
    });

    // 스크랩 패널은 /tempList 경로로 열린다. 열림 여부는 주소로 판단해서 토글이 어긋나지 않게 한다.
    // (패널이 열리면 App이 이 컴포넌트에 backgroundLocation을 넘겨 useLocation()에는 /tempList가 안 보이므로
    //  실제 주소창 경로를 본다. 경로가 바뀌면 App이 다시 렌더링되어 이 값도 갱신된다.)
    const isScrapOpen = window.location.pathname.endsWith("/tempList");
    const toggleScrapPanel = () => {
        if (isScrapOpen) {
            navigate(`/timetable/${travelId}/${period}`, { state: { period } });
        } else {
            navigate(`/timetable/${travelId}/${period}/tempList`, {
                state: { period, backgroundLocation: location }
            });
        }
    };

    useEffect(() => {
        // 지도 스크랩 마커를 누르면 스크랩 패널을 연다 (이미 열려 있으면 그대로)
        window.openScrapPanel = () => { if (!window.location.pathname.endsWith("/tempList")) toggleScrapPanel(); };
        return () => { delete window.openScrapPanel; };
    });

    return (
        <div className={styles.container}>
            <div className={styles.topBar}>
                <span className={styles.logo} onClick={() => navigate("/")}>TravelMate</span>
                <div className={styles.textMenuBar}>
                    <span
                        className={styles.textMenuItem}
                        onClick={() => {
                            if (activeMode !== "weather") {
                                setActiveMode("weather");
                                navigate(`/timetable/${travelId}/${period}/weather`, {
                                    state: { period, backgroundLocation: location }
                                });
                            } else {
                                setActiveMode(null);
                                navigate(`/timetable/${travelId}/${period}`, { state: { period } });
                            }
                        }}
                    >⛅날씨</span>

                    {/*<span className={styles.textMenuItem} onClick={() => setShowRegisterForm(true)}>장소 등록하기</span>*/}

                    <span className={styles.textMenuItem} onClick={() => navigate("/mypage")}>마이페이지</span>
                </div>
            </div>

            {showRegisterForm && (
                <TimetableModal onClose={() => setShowRegisterForm(false)}>
                    <PlaceRegister onClose={() => setShowRegisterForm(false)} />
                </TimetableModal>
            )}

            <div className={styles.content}>
                <TimelinePanel
                    schedule={schedule}
                    selectedDay={selectedDay}
                    setSelectedDay={setSelectedDay}
                    dayPageIndex={dayPageIndex}
                    setDayPageIndex={setDayPageIndex}
                    daysPerPage={daysPerPage}
                    period={period}
                    activeMode={activeMode}
                    setSchedule={setSchedule}
                    setActiveMode={setActiveMode}
                    selectedEditIndex={selectedEditIndex}
                    setSelectedEditIndex={setSelectedEditIndex}
                    setSelectedIndex={setSelectedIndex}
                    setModal={setModal}
                    handleSelectForEdit={handleSelectForEdit}
                    handleItemClick={handleDeleteItem}
                    lockedPlaces={lockedPlaces}
                    userId={userId}
                    handleDragEnd={handleDragEnd}
                    visibleTransportIndex={null}
                    handleSelectTransport={handleSelectTransport}
                    handleMoveTimeDelete={handleMoveTimeDelete}
                    toggleMemoPanel={toggleMemoPanel}
                    openPlaceDetail={openPlaceDetail}
                    isScrapOpen={isScrapOpen}
                    onToggleScrap={toggleScrapPanel}
                    hoverByPlace={hoverByPlace}
                    onHoverPlace={reportHover}
                    navigate={navigate}
                    handleSaveTime={handleSaveTime}
                    handleTimeDelete={handleTimeDelete}
                />
                {modal === "memo" && (
                    <MemoPanel
                        key={`${selectedDay}-${selectedIndex}`}
                        memos={(schedule[selectedDay]?.[selectedIndex]?.memos) || []}
                        placeName={schedule[selectedDay]?.[selectedIndex]?.name}
                        userId={userId}
                        onAddInline={addMemoInline}
                        onUpdateInline={updateMemoInline}
                        onClose={() => setModal(null)}
                    />

                )}
                {detailPlaceId && (
                    <PlaceDetailPanel
                        placeId={detailPlaceId}
                        onClose={() => setDetailPlaceId(null)}
                    />
                )}
                <div className={styles.mapPanel}>
                    <Map
                        remoteCursors={cursors}
                        onCursorMove={reportMap}
                        schedule={schedule}
                        selectedDay={selectedDay}
                        selectedIndex={selectedIndex}
                        setSelectedIndex={setSelectedIndex}
                        activeMode={activeMode}
                        setModal={setModal}
                    />
                </div>
            </div>
            {/*{modal === "memo" && (*/}
            {/*    <MemoPanel*/}
            {/*        memos={(schedule[selectedDay]?.[selectedIndex]?.memos) || []}*/}
            {/*        onClose={() => setModal(null)}*/}
            {/*        onEdit={() => setModal("editMemo")}*/}
            {/*    />*/}
            {/*)}*/}


            {isLoadingRoute && (
                <div className={styles.loadingOverlay}>
                    <div className={styles.loadingSpinner}>이동시간을 가져오는 중입니다... 🚨🚨</div>
                </div>
            )}
        </div>
    );
};

export default Timetable;
