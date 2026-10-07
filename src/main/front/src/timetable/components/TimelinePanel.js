import React, { useState } from "react";
import styles from "../Timetable.module.css";
import DraggableSchedule from "./DraggableSchedule";
import AddPlacePopover from "./AddPlacePopover";
import RouteDetail from "./RouteDetail";
import MemoPreview from "./MemoPreview";
import PresenceTags, { presenceOutline } from "./PresenceTags";

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
                           openPlaceDetail,
                           isScrapOpen = false,
                           onToggleScrap,
                           hoverByPlace = {},
                           onHoverPlace,
                           navigate,
                           handleSaveTime,
                           handleTimeDelete,
                           setSchedule,
                           modal,
                           lockedPlaces = {},
                           userId = "",
                       }) => {
    const token = localStorage.getItem("accessToken"); // 또는 "token", 프로젝트에 따라 이름 확인
    const decoded = token ? parseJwt(token) : null;
    const userRole = decoded?.role;
    const isEditable = userRole === "host" || userRole === "guest_write";
    const [addingPlace, setAddingPlace] = useState(false);
    // 이동시간 상세(어떤 대중교통을 타는지 등)가 열린 구간: "출발장소id"
    const [openRouteFrom, setOpenRouteFrom] = useState(null);
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

                <div className={styles.headerActions}>
                    {/* 스크랩한 장소: 읽기 권한만 있어도 볼 수 있다 */}
                    <button
                        className={`${styles.editDeleteButton} ${isScrapOpen ? styles.headerButtonActive : ""}`}
                        onClick={onToggleScrap}
                    >
                        🔖 스크랩
                    </button>
                    {isEditable && (
                        <button
                            className={`${styles.editDeleteButton} ${activeMode === "edit" ? styles.headerButtonActive : ""}`}
                            onClick={() => {
                                setActiveMode(activeMode === "edit" ? null : "edit");
                                setSelectedEditIndex(null);
                            }}
                        >
                            {activeMode === "edit" ? "완료" : "편집"}
                        </button>
                    )}
                </div>

            </div>

            <div className={styles.tripList}>
                {activeMode === "edit" ? (
                    <DraggableSchedule
                        schedule={schedule}
                        selectedDay={selectedDay}
                        activeMode={activeMode}
                        setActiveMode={setActiveMode}
                        handleDragEnd={handleDragEnd}
                        visibleTransportIndex={visibleTransportIndex}
                        handleSelectTransport={handleSelectTransport}
                        lockedPlaces={lockedPlaces}
                        userId={userId}
                        onSaveTime={handleSaveTime}
                        onDeleteTime={handleTimeDelete}
                        onDeleteItem={(idx) => handleItemClick(idx, "delete", schedule, selectedDay, setSchedule)}
                        hoverByPlace={hoverByPlace}
                        onHoverPlace={onHoverPlace}
                    />
                ) : Array.isArray(schedule[selectedDay]) ? (
                    schedule[selectedDay].map((item, idx) => (
                        <React.Fragment key={item.id}>
                            <div
                                className={`${styles.scheduleItem} ${activeMode === "delete" ? styles.deleteModeItem : ""}`}
                                style={presenceOutline(hoverByPlace[item.id])}
                                onMouseEnter={() => onHoverPlace?.(item.id)}
                                onMouseLeave={() => onHoverPlace?.(null)}
                                onClick={() => {
                                    if (activeMode === "delete") handleItemClick(idx, activeMode, schedule, selectedDay, setSchedule);
                                    else if (activeMode === "edit") handleSelectForEdit(idx);
                                }}
                            >
                                <PresenceTags userIds={hoverByPlace[item.id]} />
                                <div className={styles.timeBox}>
                                    {item.time || "미정"}
                                </div>

                                <div className={styles.itemText}>
                                    <img
                                        src={item.image || defaultImage}
                                        alt={`${item.name} 이미지`}
                                        className={styles.itemImage}
                                    />
                                    <div className={styles.itemBody}>
                                        <div
                                            className={styles.itemTitle}
                                            onClick={() => openPlaceDetail(item.mongo, item)}
                                        >
                                            {item.name}
                                        </div>
                                        <div className={styles.itemCategory}>{item.address}</div>
                                        <MemoPreview
                                            memos={item.memos}
                                            onOpen={(e) => {
                                                e.stopPropagation();
                                                toggleMemoPanel(idx);
                                            }}
                                            onAdd={(e) => {
                                                // 메모 패널을 열면 메모가 없는 장소는 바로 새 메모 양식이 뜬다
                                                e.stopPropagation();
                                                toggleMemoPanel(idx);
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {idx < schedule[selectedDay].length - 1 && (
                                <>
                                <div className={styles.verticalConnectorWrapper}>
                                    <div className={styles.verticalLine} />
                                    <button
                                        className={`${styles.moveTimeButton} ${activeMode === "delete" ? styles.deleteModeItem : ""}`}
                                        onClick={() => {
                                            if (activeMode === "delete") {
                                                handleMoveTimeDelete(idx);
                                            } else {
                                                // 바로 링크로 가지 않고 아래에 경로 상세 + 길찾기 버튼을 연다
                                                setOpenRouteFrom(prev => (prev === item.id ? null : item.id));
                                            }
                                        }}
                                    >
                                        <div className={styles.labelRow}>
                                            <label className={styles.transferText}>{item.type || "이동수단 미정"}</label>
                                            {item.travelTime && <label className={styles.transferText}>{item.travelTime}</label>}
                                        </div>
                                    </button>
                                </div>
                                {openRouteFrom === item.id && (
                                    <RouteDetail
                                        from={item}
                                        to={schedule[selectedDay][idx + 1]}
                                        onClose={() => setOpenRouteFrom(null)}
                                    />
                                )}
                                </>
                            )}
                        </React.Fragment>
                    ))
                ) : (
                    <div className={styles.emptyMessage}>일정이 없습니다</div>
                )}
            </div>

            {isEditable && (
                <div className={styles.addPlaceArea}>
                    {/* 버튼 바로 위에 뜨는 직접 추가 창 */}
                    {addingPlace && (
                        <AddPlacePopover
                            onClose={() => setAddingPlace(false)}
                            anchor={(() => {
                                // 이 여행에 이미 있는 장소(오늘 → 다른 날 순) 근처 주소를 먼저 보여준다
                                const all = [...(schedule[selectedDay] || []), ...Object.values(schedule).flat()];
                                const p = all.find(x => x?.latitude != null && x?.longitude != null);
                                return p ? { lat: Number(p.latitude), lng: Number(p.longitude) } : null;
                            })()}
                        />
                    )}
                    <div
                        className={`${styles.guideToast} ${addingPlace ? styles.guideToastActive : ""}`}
                        onClick={() => setAddingPlace(v => !v)}
                    >
                        {addingPlace ? "닫기" : "➕ 원하는 장소가 없다면 여기를 클릭하세요!"}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimelinePanel;
