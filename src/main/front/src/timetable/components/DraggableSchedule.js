import React, { useState } from "react";
import TimePicker from "./TimePicker";
import PresenceTags, { presenceOutline } from "./PresenceTags";
import styles from "../Timetable.module.css";
import {closestCenter, DndContext, PointerSensor, useSensor, useSensors} from "@dnd-kit/core";
import {SortableContext, useSortable, verticalListSortingStrategy} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";

const defaultImage = "https://capstone12345-bu.s3.ap-northeast-2.amazonaws.com/memo/1748504910375_%EC%9D%B4%EB%AF%B8%EC%A7%80%20%EC%97%86%EC%9D%8C.png";

// 정렬 가능한 한 칸 = 장소 카드 + (아래) 이동수단 버튼.
// 버튼을 같은 노드 안에 넣어야 dnd-kit이 칸 높이를 올바르게 계산해 드래그 중 항목이 튀지 않는다.
const SortableScheduleItem = ({ item, onTimeClick, onDelete, isLocked, isTimeOpen, timePicker, hoveredBy, onHover, children }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id, disabled: !!isLocked });

    const wrapperStyle = {
        transform: CSS.Transform.toString(transform),
        transition,
        position: "relative",
        zIndex: isDragging ? 1000 : undefined,
    };

    const cardStyle = {
        opacity: isLocked ? 0.5 : isDragging ? 0.8 : 1,
        pointerEvents: isLocked ? "none" : "auto",
        cursor: isLocked ? "default" : isDragging ? "grabbing" : "grab",
        touchAction: "none",
    };

    return (
        <div
            ref={setNodeRef}
            style={{ ...wrapperStyle, ...presenceOutline(hoveredBy) }}
            onMouseEnter={() => onHover?.(item.id)}
            onMouseLeave={() => onHover?.(null)}
            className={`${styles.sortableBlock} ${isDragging ? styles.sortableBlockDragging : ""} ${isLocked ? styles.sortableBlockLocked : ""}`}
        >
            <PresenceTags userIds={hoveredBy} />
            {!isLocked && !isDragging && (
                <button
                    className={styles.blockDeleteButton}
                    title="장소 삭제"
                    aria-label={`${item.name} 삭제`}
                    // 드래그 리스너는 카드에만 달려 있어 여기서 누르면 드래그가 시작되지 않는다.
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete?.();
                    }}
                >
                    ×
                </button>
            )}
            <div
                {...attributes}
                {...listeners}
                style={cardStyle}
                // 편집 모드에서는 카드 클릭(선택/색 변경) 없이 드래그만 한다.
                className={styles.scheduleItem}
            >
                <div
                    className={`${styles.timeBox} ${styles.timeBoxEditable} ${isTimeOpen ? styles.timeBoxOpen : ""}`}
                    title="클릭해서 방문시간 설정"
                    onClick={(e) => {
                        // 카드 선택(잠금) 클릭과 분리
                        e.stopPropagation();
                        onTimeClick?.();
                    }}
                >
                    {item.time || "미정"}
                </div>
                <div className={styles.itemText}>
                    <div className={styles.itemTitle}>
                        {item.name}
                        {isLocked && <span style={{ marginLeft: 8, color: "red" }}>🔒</span>}
                    </div>
                    <div className={styles.itemCategory}>{item.category}</div>
                </div>
            </div>
            {isTimeOpen && timePicker}
            {children}
        </div>
    );
};

const DraggableSchedule = ({
                               schedule,
                               selectedDay,
                               activeMode,
                               handleDragEnd,
                               handleSelectTransport,
                               setActiveMode,
                               lockedPlaces = {},
                               userId = "",
                               onSaveTime,
                               onDeleteTime,
                               onDeleteItem,
                               hoverByPlace = {},
                               onHoverPlace
                           }) => {
    // 시간 선택 패널이 열린 장소 id (순서가 바뀌어도 같은 장소에 붙어 있도록 index 대신 id로 관리)
    const [openTimeId, setOpenTimeId] = useState(null);
    // 5px 이상 움직여야 드래그 시작 → 단순 클릭(선택)과 이동수단 버튼 클릭이 드래그로 오인되지 않음
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    if (activeMode !== "edit") return null;

    const dayItems = schedule[selectedDay] || [];

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
                items={dayItems.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
            >
                {dayItems.map((item, idx) => {
                    const isLocked = lockedPlaces[item.id] && lockedPlaces[item.id] !== userId;
                    return (
                            <SortableScheduleItem
                                key={item.id}
                                item={item}
                                onDelete={() => onDeleteItem?.(idx)}
                                hoveredBy={hoverByPlace[item.id]}
                                onHover={onHoverPlace}
                                onTimeClick={() => setOpenTimeId(prev => (prev === item.id ? null : item.id))}
                                isTimeOpen={openTimeId === item.id}
                                timePicker={
                                    <TimePicker
                                        dayItems={dayItems}
                                        index={idx}
                                        onSave={onSaveTime}
                                        onDelete={onDeleteTime}
                                        onClose={() => setOpenTimeId(null)}
                                    />
                                }
                                isLocked={isLocked}
                            >
                            {idx < dayItems.length - 1 && !isLocked && (
                                <div className={styles.transportOptionsInline}>
                                    <button className={styles.moveTimeButton} onClick={() =>
                                    {
                                        handleSelectTransport("🚗 자동차", idx)
                                        setActiveMode(null);
                                    }

                                    }
                                        >🚗 자동차</button>
                                    <button className={styles.moveTimeButton} onClick={() => {
                                        handleSelectTransport("🚶 도보", idx)
                                        setActiveMode(null);
                                    }
                                    }>🚶 도보</button>
                                    <button className={styles.moveTimeButton} onClick={() => {
                                        handleSelectTransport("🚌 대중교통", idx)
                                        setActiveMode(null);
                                    }}>🚌 대중교통</button>
                                </div>
                            )}
                            </SortableScheduleItem>
                    )
                }
                )}
            </SortableContext>
        </DndContext>
    );
};

export default DraggableSchedule;
