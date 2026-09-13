import React from "react";
import styles from "../Timetable.module.css";

const MemoPanel = ({ memos, onClose, onEdit, onAdd }) => {
    return (
        <div className={styles.memoPanel}>
            <div className={styles.memoPanelHeader}>
                <h3>메모</h3>
                <div>
                    <button onClick={onAdd}>추가</button>
                    <button onClick={onClose}>닫기</button>
                </div>
            </div>

            {(memos || []).map((memoGroup, idx) => (
                <div key={idx} className={styles.memoGroup}>
                    <div className={styles.memoGroupHeader}>
                        <h4>{memoGroup.title}</h4>
                        <button className={styles.editButton} onClick={() => onEdit(memoGroup)}>수정</button>
                    </div>

                    <ul>
                        {["image", "link", "text"].map(type =>
                            (Array.isArray(memoGroup.contents) ? memoGroup.contents : [])
                                .filter(c => c.type === type)
                                .map((c, i) => (
                                    <li key={`${type}-${i}`} className={styles.memoItem}>
                                        {type === "image" ? (
                                            <img src={c.content} alt="memo" className={styles.memoImage} />
                                        ) : (
                                            <span style={{ whiteSpace: "pre-wrap" }}>{c.content}</span>
                                        )}
                                    </li>
                                ))
                        )}
                    </ul>
                </div>
            ))}
        </div>
    );
};

export default MemoPanel;
