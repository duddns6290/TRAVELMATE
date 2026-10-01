import React, { useEffect, useRef, useState } from "react";
import styles from "../Timetable.module.css";
import { buildTimeSlots, getTimeBounds } from "../utils/timeSlots";

// 편집 모드에서 시간 박스 바로 아래로 펼쳐지는 30분 단위 방문시간 선택 패널
const TimePicker = ({ dayItems, index, onSave, onDelete, onClose }) => {
    const [saving, setSaving] = useState(false);
    const listRef = useRef(null);
    const currentTime = dayItems[index]?.time || null;
    const { prevPlace, nextPlace } = getTimeBounds(dayItems, index);
    const slots = buildTimeSlots(dayItems, index, currentTime);

    // 열릴 때 현재 시간(없으면 선택 가능한 첫 시간, 그것도 없으면 09:00) 근처로 스크롤
    useEffect(() => {
        const target =
            currentTime ||
            slots.find(s => !s.disabled && s.value >= "09:00")?.value ||
            slots.find(s => !s.disabled)?.value;
        const el = target && listRef.current?.querySelector(`[data-time="${target}"]`);
        if (el) listRef.current.scrollTop = el.offsetTop - listRef.current.offsetTop - 8;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handlePick = async (value) => {
        if (saving) return;
        setSaving(true);
        const saved = await onSave(index, value);
        setSaving(false);
        if (saved) onClose();
    };

    return (
        <div className={styles.timePicker} onClick={(e) => e.stopPropagation()}>
            <div className={styles.timePickerHeader}>
                <span>방문 시간</span>
                <button className={styles.timePickerClose} onClick={onClose} aria-label="닫기">×</button>
            </div>

            {(prevPlace || nextPlace) && (
                <div className={styles.timePickerHint}>
                    {prevPlace && <span>⬆ {prevPlace.name} {prevPlace.time} 이후</span>}
                    {nextPlace && <span>⬇ {nextPlace.name} {nextPlace.time} 이전</span>}
                </div>
            )}

            <div className={styles.timePickerGrid} ref={listRef}>
                {slots.map(slot => (
                    <button
                        key={slot.value}
                        data-time={slot.value}
                        disabled={slot.disabled || saving}
                        className={`${styles.timeChip} ${slot.value === currentTime ? styles.timeChipActive : ""}`}
                        onClick={() => handlePick(slot.value)}
                    >
                        {slot.value}
                    </button>
                ))}
            </div>

            {currentTime && (
                <button
                    className={styles.timePickerDelete}
                    onClick={async (e) => {
                        await onDelete(e, index);
                        onClose();
                    }}
                >
                    시간 지우기
                </button>
            )}
        </div>
    );
};

export default TimePicker;
