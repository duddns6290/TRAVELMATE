import React from "react";
import styles from "../Timetable.module.css";
import {closestCenter, DndContext, PointerSensor, useSensor, useSensors} from "@dnd-kit/core";
import {SortableContext, useSortable, verticalListSortingStrategy} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";

const defaultImage = "https://capstone12345-bu.s3.ap-northeast-2.amazonaws.com/memo/1748504910375_%EC%9D%B4%EB%AF%B8%EC%A7%80%20%EC%97%86%EC%9D%8C.png";

const SortableScheduleItem = ({ item, index, onClick, isSelected, onMemoAdd, isLocked }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isSelected ? 1000 : undefined,
        opacity: isLocked ? 0.5 : 1,
        pointerEvents: isLocked ? "none" : "auto",
    };

    return (
        <div
            ref={setNodeRef}
            {...(!isLocked && attributes)}
            {...(!isLocked && listeners)}
            style={style}
            className={`${styles.scheduleItem} ${isSelected ? styles.selectedItem : ""}`}
            onClick={!isLocked ? onClick : undefined}
        >
            <div className={styles.timeBox}>{item.time || "미정"}</div>
            <div className={styles.itemText}>
                <div className={styles.itemTitle}>
                    {item.name}
                    {isLocked && <span style={{ marginLeft: 8, color: "red" }}>🔒</span>}
                </div>
                <div className={styles.itemCategory}>{item.category}</div>
            </div>
        </div>
    );
};

const DraggableSchedule = ({
                               schedule,
                               selectedDay,
                               activeMode,
                               onItemClick,
                               selectedEditIndex,
                               handleDragEnd,
                               handleSelectTransport,
                               setActiveMode,
                               lockedPlaces = {},
                               userId = ""

                           }) => {
    const sensors = useSensors(useSensor(PointerSensor));

    if (activeMode !== "edit") return null;

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
                items={schedule[selectedDay].map((item) => item.id)}
                strategy={verticalListSortingStrategy}
            >
                {schedule[selectedDay].map((item, idx) => {
                    const isLocked = lockedPlaces[item.id] && lockedPlaces[item.id] !== userId;
                    return (
                        <React.Fragment key={item.id}>
                            <SortableScheduleItem
                                item={item}
                                index={idx}
                                onClick={() => onItemClick(idx)}
                                isSelected={selectedEditIndex === idx}
                                isLocked={isLocked}
                            />

                            {idx < schedule[selectedDay].length - 1 && !isLocked && (
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
                         </React.Fragment>

                    )
                }
                )}
            </SortableContext>
        </DndContext>
    );
};

export default DraggableSchedule;
