import React, { useState } from "react";
import styles from "../Timetable.module.css";
import DraggableSchedule from "./DraggableSchedule";

const defaultImage = "https://capstone12345-bu.s3.ap-northeast-2.amazonaws.com/memo/1748504910375_%EC%9D%B4%EB%AF%B8%EC%A7%80%20%EC%97%86%EC%9D%8C.png";
// JWT 디코딩을 위해 필요한 유틸
const parseJwt = (token) => {
    try {
        return JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
        return null;
    }
};

const TimelinePanel = ({
                           schedule,
                           selectedDay,
                           setSelectedDay,
                           dayPageIndex,
                           setDayPageIndex,
                           daysPerPage,
                           period,
                           activeMode,
                           setActiveMode,
                           selectedEditIndex,
                           setSelectedEditIndex,
                           setSelectedIndex,
                           setModal,
                           handleSelectForEdit,
                           handleItemClick,
                           handleDragEnd,
                           visibleTransportIndex,
                           handleSelectTransport,
                           handleMoveTimeDelete,
                           toggleMemoPanel,
                           navigate,
                           setNewTime,
                           setSchedule,
                           modal,
                       }) => {
    const token = localStorage.getItem("accessToken"); // 또는 "token", 프로젝트에 따라 이름 확인
    const decoded = token ? parseJwt(token) : null;
    const userRole = decoded?.role;
    const isEditable = userRole === "host" || userRole === "guest_write";
    const [lockedPlaces, setLockedPlaces] = useState({});
    const userId = sessionStorage.getItem("userId")
    return (
        <div className={styles.timelinePanel}>
            <div className={styles.headerRow}>
                <div className={styles.dayNavigation}>
                    <button
                        className={`${styles.arrowButton} ${dayPageIndex === 0 ? styles.disabled : ""}`}
                        onClick={() => {
                            if (dayPageIndex > 0) setDayPageIndex(prev => prev - 1);
                        }}
                        disabled={dayPageIndex === 0}
                    >
                        ◀
                    </button>

                    {Array.from({ length: period }, (_, i) => i + 1)
                        .slice(dayPageIndex * daysPerPage, (dayPageIndex + 1) * daysPerPage)
                        .map(day => (
                            <button
                                key={day}
                                className={selectedDay === day ? styles.activeTab : styles.tab}
                                onClick={() => {
                                    setSelectedDay(day);
                                    sessionStorage.setItem("selectedDay", day);
                                }}
                            >
                                Day {day}
                            </button>
                        ))}

                    <button
                        className={`${styles.arrowButton} ${(dayPageIndex + 1) * daysPerPage >= period ? styles.disabled : ""}`}
                        onClick={() => {
                            if ((dayPageIndex + 1) * daysPerPage < period) {
                                setDayPageIndex(prev => prev + 1);
                            }
                        }}
                        disabled={(dayPageIndex + 1) * daysPerPage >= period}
                    >
                        ▶
                    </button>
                </div>

                {isEditable && (
                    <div>
                        <button
                            className={styles.editDeleteButton}
                            onClick={() => {
                                setActiveMode(activeMode === "edit" ? null : "edit");
                                setSelectedEditIndex(null);
                            }}
                        >
                            편집
                        </button>
                        <button
                            className={`${styles.editDeleteButton} ${activeMode === "delete" ? styles.deleteModeItemButton : ""}`}
                            onClick={() => setActiveMode(activeMode === "delete" ? null : "delete")}
                        >
                            삭제
                        </button>
                        <button
                            className={styles.editDeleteButton}
                            onClick={() => setActiveMode(activeMode === "time" ? null : "time")}
                        >
                            시간 추가
                        </button>
                    </div>
                )}

            </div>

            <div className={styles.tripList}>
                {activeMode === "edit" ? (
                    <DraggableSchedule
                        schedule={schedule}
                        selectedDay={selectedDay}
                        activeMode={activeMode}
                        onItemClick={handleSelectForEdit}
                        selectedEditIndex={selectedEditIndex}
                        setActiveMode={setActiveMode}
                        handleDragEnd={handleDragEnd}
                        visibleTransportIndex={visibleTransportIndex}
                        handleSelectTransport={handleSelectTransport}
                        lockedPlaces={lockedPlaces}
                        userId={userId}
                    />
                ) : Array.isArray(schedule[selectedDay]) ? (
                    schedule[selectedDay].map((item, idx) => (
                        <React.Fragment key={item.id}>
                            <div
                                className={`${styles.scheduleItem} ${activeMode === "delete" ? styles.deleteModeItem : ""}`}
                                onClick={() => {
                                    if (activeMode === "delete") handleItemClick(idx, activeMode, schedule, selectedDay, setSchedule);
                                    else if (activeMode === "edit") handleSelectForEdit(idx);
                                }}
                            >
                                <div
                                    className={styles.timeBox}
                                    onClick={() => {
                                        if (activeMode === "time") {
                                            setSelectedIndex(idx);
                                            setNewTime(item.time || "");
                                            setModal("time");
                                        }
                                    }}
                                    style={{ cursor: activeMode === "time" ? "pointer" : "default" }}
                                >
                                    {item.time || "미정"}
                                </div>

                                <div className={styles.itemText}>
                                    <img
                                        src={item.image || defaultImage}
                                        alt={`${item.name} 이미지`}
                                        className={styles.itemImage}
                                    />
                                    <div>
                                        <div
                                            className={styles.itemTitle}
                                            onClick={() => {
                                                if (activeMode !== "delete") {
                                                    const mongoId = schedule[selectedDay][idx].mongo;
                                                    if (!mongoId) {
                                                        alert("상세 정보를 불러오지 못하는 장소입니다.");
                                                        return;
                                                    }
                                                    navigate(`/place/${mongoId}`);
                                                }
                                            }}
                                        >
                                            {item.name}
                                        </div>
                                        <div className={styles.itemCategory}>{item.address}</div>
                                    </div>

                                    {item.memos?.length > 0 && (
                                        <div
                                            className={styles.memoBox}
                                            onClick={() => toggleMemoPanel(idx)}
                                        >
                                            메모
                                        </div>
                                    )}
                                </div>

                                {(item.memos?.length ?? 0) === 0 && (
                                    <button
                                        className={styles.memoAddButton}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedIndex(idx);
                                            setModal("addMemo");
                                        }}
                                    >
                                        <span className={styles.plusIcon} >＋</span>
                                    </button>
                                )}
                            </div>

                            {idx < schedule[selectedDay].length - 1 && (
                                <div className={styles.verticalConnectorWrapper}>
                                    <div className={styles.verticalLine} />
                                    <button
                                        className={`${styles.moveTimeButton} ${activeMode === "delete" ? styles.deleteModeItem : ""}`}
                                        onClick={() => {
                                            if (activeMode === "delete") {
                                                handleMoveTimeDelete(idx);
                                            } else {
                                                const url = schedule[selectedDay]?.[idx]?.placeUrl;
                                                if (url) window.open(url, "_blank");
                                            }
                                        }}
                                    >
                                        <div className={styles.labelRow}>
                                            <label className={styles.transferText}>{schedule[selectedDay]?.[idx]?.type || "type"}</label>
                                            <label className={styles.transferText}>{schedule[selectedDay]?.[idx]?.travelTime || "미정"}</label>
                                        </div>
                                    </button>
                                </div>
                            )}
                        </React.Fragment>
                    ))
                ) : (
                    <div className={styles.emptyMessage}>일정이 없습니다</div>
                )}
            </div>

            {modal !== "place" && isEditable && (
                <div
                    className={styles.guideToast}
                    onClick={() => {
                        setModal("place");
                        setActiveMode(null);
                    }}
                >
                    ➕ 원하는 장소가 없다면 여기를 클릭하세요!
                </div>
            )}
        </div>
    );
};

export default TimelinePanel;
