import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import styles from "./Timetable.module.css";
import Map from "../Map/Map";
import TimelinePanel from "./components/TimelinePanel";
import MemoPanel from "./components/MemoPanel";
import TimetableModal from "./components/TimetableModal";
import PlaceRegister from "../Temp/PlaceRegister";
import {
    fetchSchedule,
    handleItemClick,
    useDragHandler
} from "./hooks/useSchedule";
import { handleAddPlace } from "./utils/PlacesUtil";
import useMemoHandler from "./hooks/useMemoHandler";
import useMoveTime from "./hooks/useMoveTime";
import useTimeEdit from "./hooks/useTimeEdit";
import useWebSocket from "./hooks/useWebSocket";
import { applySchedulePatch } from "./utils/applySchedulePatch";

const Timetable = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const [schedule, setSchedule] = useState({});
    const [selectedDay, setSelectedDay] = useState(1);
    const [selectedIndex, setSelectedIndex] = useState(null);
    const [modal, setModal] = useState(null);
    const [newPlace, setNewPlace] = useState({ name: "", address: "", category: "음식점" });
    const [activeMode, setActiveMode] = useState(null);
    const [dayPageIndex, setDayPageIndex] = useState(0);
    const [isLoadingRoute, setIsLoadingRoute] = useState(false);
    const [selectedEditIndex, setSelectedEditIndex] = useState(null);
    const [dontShowAgain, setDontShowAgain] = useState(false);
    const [showEditHelp, setShowEditHelp] = useState(() => localStorage.getItem("showEditHelp") !== "false");
    const [showRegisterForm, setShowRegisterForm] = useState(false);
    const [newTime, setNewTime] = useState("");
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
        } else if (message.userId !== userId) {
            // 내가 보낸 패치는 이미 로컬에 반영했으므로, 다른 사용자가 보낸 패치만 병합한다.
            setSchedule(prev => applySchedulePatch(prev, message));
        }
    };
    const { sendLock, sendUnlock, sendMessage } = useWebSocket({
        travelId,
        onMessageReceive: handleSocketMessage,
    });

    // 편집 액션 하나를 로컬 상태에 반영하는 동시에 같은 travelId를 보는 다른 사용자에게 전파한다.
    const applyAndBroadcast = (type, placeId, newValue) => {
        setSchedule(prev => applySchedulePatch(prev, { type, placeId, newValue }));
        sendMessage({ type, travelId: Number(travelId), userId, placeId, newValue, timestamp: Date.now() });
    };

    useEffect(() => {
        // Map.js 등 React 트리 밖의 코드(initializeMap.js)에서도 호출할 수 있도록 전역에 노출
        window.applyAndBroadcast = applyAndBroadcast;
        return () => { delete window.applyAndBroadcast; };
    }, [travelId, userId]);

    const { handleDragEnd } = useDragHandler(schedule, setSchedule, selectedDay, applyAndBroadcast);



    useEffect(() => {
        return () => {
            const place = schedule[selectedDay]?.[selectedEditIndex];
            if (place) sendUnlock({ placeId: place.id, userId });
        };
    }, [selectedEditIndex]);



    const {
        memoTitle, setMemoTitle,
        textContent, setTextContent,
        linkContent, setLinkContent,
        imageFile, setImageFile,
        isAddingToExisting, setIsAddingToExisting,
        targetMemoTitle, setTargetMemoTitle,
        handleAddOrEditMemo: handleAddMemo,

        resetMemoInput,
        handleStartEditMemoGroup,
        isEditMode
    } = useMemoHandler({ schedule, setSchedule, selectedDay, selectedIndex, setModal, applyAndBroadcast });

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


    const handleSubmit = (e) => {
        e.preventDefault();
        handleAddPlace(newPlace, setNewPlace, setModal);
    };

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

    const toggleMemoPanel = (index) => {
        setSelectedIndex(index);
        setModal("memo");
    };

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

                    <span
                        className={styles.textMenuItem}
                        onClick={() => {
                            if (activeMode !== "tempList") {
                                setActiveMode("tempList");
                                navigate(`/timetable/${travelId}/${period}/tempList`, {
                                    state: { period, backgroundLocation: location }
                                });
                            } else {
                                setActiveMode(null);
                                navigate(`/timetable/${travelId}/${period}`, { state: { period } });
                            }
                        }}
                    >스크랩한 장소</span>

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
                    navigate={navigate}
                    setNewTime={setNewTime}
                />
                {modal === "memo" && (
                    <MemoPanel
                        memos={(schedule[selectedDay]?.[selectedIndex]?.memos) || []}
                        onClose={() => setModal(null)}
                        onEdit={(memoGroup) => {
                            handleStartEditMemoGroup(memoGroup); // ✅ 수정 시작
                        }}
                        onAdd={() => setModal("addMemo")}
                    />

                )}
                <div className={styles.mapPanel}>
                    <Map
                        schedule={schedule}
                        selectedDay={selectedDay}
                        selectedIndex={selectedIndex}
                        setSelectedIndex={setSelectedIndex}
                        activeMode={activeMode}
                        setModal={setModal}
                    />
                </div>
            </div>
            {modal === "addMemo" && (
                <TimetableModal title="메모 추가" onClose={() => setModal(null)}>
                    <input
                        placeholder="메모 제목"
                        value={memoTitle}
                        onChange={e => setMemoTitle(e.target.value)}
                    />
                    <textarea
                        placeholder="텍스트 메모"
                        value={textContent}
                        onChange={e => setTextContent(e.target.value)}
                    />
                    <input
                        placeholder="링크 메모"
                        value={linkContent}
                        onChange={e => setLinkContent(e.target.value)}
                    />
                    <input
                        type="file"
                        accept="image/*"
                        onChange={e => setImageFile(e.target.files[0])}
                    />
                    <button
                        onClick={() => {
                            handleAddMemo();
                            setModal(null);
                        }}
                    >저장</button>
                </TimetableModal>
            )}

            {modal === "place" && (
                <TimetableModal title="장소 추가" onClose={() => setModal(null)}>
                    <input
                        value={newPlace.name}
                        onChange={e => setNewPlace({ ...newPlace, name: e.target.value })}
                        placeholder="장소 이름"
                    />
                    <input
                        value={newPlace.address || ""}
                        onChange={e => setNewPlace({ ...newPlace, address: e.target.value })}
                        placeholder="주소"
                    />
                    <select
                        value={newPlace.category}
                        onChange={e => setNewPlace({ ...newPlace, category: e.target.value })}
                    >
                        <option>음식점</option>
                        <option>관광지</option>
                        <option>숙소</option>
                    </select>
                    <button onClick={() => handleAddPlace(newPlace, setNewPlace, setModal)}>추가</button>
                </TimetableModal>
            )}
            {/*{modal === "memo" && (*/}
            {/*    <MemoPanel*/}
            {/*        memos={(schedule[selectedDay]?.[selectedIndex]?.memos) || []}*/}
            {/*        onClose={() => setModal(null)}*/}
            {/*        onEdit={() => setModal("editMemo")}*/}
            {/*    />*/}
            {/*)}*/}

            {modal === "addPlace" && (
                <TimetableModal title="장소 등록" onClose={() => setModal(null)}>
                    <form onSubmit={handleSubmit}>
                        <input
                            type="text"
                            placeholder="장소 이름"
                            value={newPlace.name}
                            onChange={e => setNewPlace(p => ({ ...p, name: e.target.value }))}
                            required
                        />
                        <input
                            type="text"
                            placeholder="주소"
                            value={newPlace.address}
                            onChange={e => setNewPlace(p => ({ ...p, address: e.target.value }))}
                            required
                        />
                        <button type="submit">등록</button>
                    </form>
                </TimetableModal>
            )}

            {modal === "time" && (
                <TimetableModal title="방문 시간 설정" onClose={() => setModal(null)}>
                    <input
                        type="time"
                        value={newTime}
                        onChange={(e) => setNewTime(e.target.value)}
                    />
                    <button
                        onClick={async () => {
                            await handleSaveTime(selectedIndex, newTime);
                            setModal(null);
                            setNewTime("");
                        }}
                    >
                        저장
                    </button>
                    <button
                        onClick={(e) => {
                            handleTimeDelete(e, selectedIndex);
                            setModal(null);
                            setNewTime("");
                        }}
                        style={{backgroundColor: "red", color: "white"}}
                    >
                        삭제
                    </button>
                </TimetableModal>
            )}
            {isEditMode && modal === "memo" && (
                <TimetableModal title="메모 수정" onClose={() => setModal(null)}>
                    <input
                        placeholder="메모 제목"
                        value={memoTitle}
                        onChange={e => setMemoTitle(e.target.value)}
                    />
                    <textarea
                        placeholder="텍스트 메모"
                        value={textContent}
                        onChange={e => setTextContent(e.target.value)}
                    />
                    <input
                        placeholder="링크 메모"
                        value={linkContent}
                        onChange={e => setLinkContent(e.target.value)}
                    />
                    <input
                        type="file"
                        accept="image/*"
                        onChange={e => setImageFile(e.target.files[0])}
                    />
                    <button
                        onClick={() => {
                            handleAddMemo(); // 수정 저장
                            setModal(null);
                        }}
                    >저장</button>
                </TimetableModal>
            )}

            {isLoadingRoute && (
                <div className={styles.loadingOverlay}>
                    <div className={styles.loadingSpinner}>이동시간을 가져오는 중입니다... 🚨🚨</div>
                </div>
            )}
        </div>
    );
};

export default Timetable;
