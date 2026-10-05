import React from "react";
import styles from "../Timetable.module.css";
import { memoColorFor } from "../utils/memoColor";

// 메모 한 개를 한 줄로 요약: 텍스트 → 링크 → 사진 순으로 보여줄 것을 고른다
const summarize = (memo) => {
    const contents = memo.contents || [];
    const text = contents.find(c => c.type === "text" && c.content?.trim())?.content;
    if (text) return text;
    if (contents.some(c => c.type === "link")) return "🔗 링크";
    if (contents.some(c => c.type === "image")) return "🖼 사진";
    return "메모";
};

// 장소 카드 주소 밑 메모 미리보기.
// 작성자별 색으로 메모 내용만 나란히 보여주고, 누르면 메모 패널(onOpen)이 열리고 닫힌다.
const MemoPreview = ({ memos = [], onOpen, onAdd }) => {
    if (!memos.length) {
        return (
            <button className={styles.memoAddLink} onClick={onAdd}>
                + 메모 추가
            </button>
        );
    }

    return (
        <div className={styles.memoChips} onClick={onOpen} title="메모 보기 (한 번 더 누르면 닫힘)">
            {memos.map((memo, i) => {
                const color = memoColorFor(memo.userId);
                return (
                    <span
                        key={memo.memoId ?? i}
                        className={styles.memoChip}
                        style={{ background: color.bg, borderColor: color.accent, color: color.text }}
                    >
                        {summarize(memo)}
                    </span>
                );
            })}
        </div>
    );
};

export default MemoPreview;
