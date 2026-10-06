import React from "react";
import styles from "../Timetable.module.css";
import { memoColorFor } from "../utils/memoColor";

// 다른 사람이 마우스를 올려 둔 장소 카드에 붙는 이름표들 (사람별 색)
export const presenceOutline = (userIds = []) =>
    userIds.length
        ? { boxShadow: userIds.slice(0, 3).map((u, i) => `0 0 0 ${2 + i * 2}px ${memoColorFor(u).accent}`).join(", ") }
        : undefined;

const PresenceTags = ({ userIds = [] }) => {
    if (!userIds.length) return null;
    return (
        <div className={styles.presenceTags}>
            {userIds.map(u => (
                <span key={u} className={styles.presenceTag} style={{ background: memoColorFor(u).accent }}>
                    {u}
                </span>
            ))}
        </div>
    );
};

export default PresenceTags;
