// 📁 src/components/TimetableModal.js
import React from "react";
import styles from "../Timetable.module.css";

/**
 * 재사용 가능한 모달 컴포넌트
 * @param {string} title - 모달 제목
 * @param {React.ReactNode} children - 모달 내용
 * @param {function} onClose - 닫기 함수
 */
const TimetableModal = ({ title, children, onClose }) => {
    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modal}>
                {title && <h3>{title}</h3>}
                {children}
                <button onClick={onClose} className={styles.modalClose}>닫기</button>
            </div>
        </div>
    );
};

export default TimetableModal;
