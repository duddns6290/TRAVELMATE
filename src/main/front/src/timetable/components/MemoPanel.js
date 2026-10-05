import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "../Timetable.module.css";
import { memoColorFor } from "../utils/memoColor";

// 연하게 뜨는 메모 양식. 새 메모 추가와 본인 메모 수정에 같이 쓴다.
// 수정할 때는 사진은 그대로 두고 내용/링크만 바꾼다.
const MemoForm = ({ color, initial, onSave, onCancel }) => {
    const isEdit = !!initial;
    const [text, setText] = useState(initial?.text || "");
    const [link, setLink] = useState(initial?.link || "");
    const [imageFile, setImageFile] = useState(null);
    const [saving, setSaving] = useState(false);
    const textRef = useRef(null);

    useEffect(() => {
        textRef.current?.focus();
    }, []);

    const canSave = text.trim() || link.trim() || imageFile || (isEdit && initial.hasImage);

    const handleSave = async () => {
        if (!canSave || saving) return;
        setSaving(true);
        const ok = await onSave({ text: text.trim(), link: link.trim(), imageFile });
        setSaving(false);
        if (ok) onCancel();
    };

    return (
        <div
            className={`${styles.memoGroup} ${styles.memoDraft}`}
            style={{ background: color.bg, borderLeft: `4px dashed ${color.accent}`, color: color.text }}
            onKeyDown={(e) => {
                if (e.key === "Escape") onCancel();
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSave();
            }}
        >
            <textarea
                ref={textRef}
                className={styles.memoDraftInput}
                placeholder="메모를 남겨보세요"
                rows={3}
                value={text}
                onChange={e => setText(e.target.value)}
            />
            <input
                className={styles.memoDraftInput}
                placeholder="🔗 링크 (선택)"
                value={link}
                onChange={e => setLink(e.target.value)}
            />
            <div className={styles.memoDraftFooter}>
                {isEdit ? (
                    <span />
                ) : (
                    <label className={styles.memoDraftImage}>
                        🖼 {imageFile ? imageFile.name : "사진 첨부"}
                        <input type="file" accept="image/*" hidden onChange={e => setImageFile(e.target.files[0] || null)} />
                    </label>
                )}
                <div className={styles.memoDraftActions}>
                    <button className={styles.memoDraftCancel} onClick={onCancel}>취소</button>
                    <button
                        className={styles.memoDraftSave}
                        style={{ background: color.accent }}
                        disabled={!canSave || saving}
                        onClick={handleSave}
                    >
                        {saving ? "저장 중..." : isEdit ? "저장" : "추가"}
                    </button>
                </div>
            </div>
        </div>
    );
};

const MemoPanel = ({ memos, onClose, onAddInline, onUpdateInline, userId, placeName }) => {
    const list = memos || [];
    const myMemo = userId ? list.find(m => m.userId === userId) : null;
    // 메모가 하나도 없으면 열자마자 새 메모 양식을 보여준다
    const [drafting, setDrafting] = useState(list.length === 0);
    const [editingId, setEditingId] = useState(null);
    const myColor = memoColorFor(userId);

    // 지도 위 검색창·음식점/카페 버튼 줄 바로 아래에서 시작하도록 위치를 맞춘다
    const panelRef = useRef(null);
    const [top, setTop] = useState(null);
    useLayoutEffect(() => {
        const overlay = document.querySelector(".map-overlay .map-controls") || document.querySelector(".map-overlay");
        const measure = () => {
            const parent = panelRef.current?.offsetParent;
            if (!overlay || !parent) return;
            setTop(overlay.getBoundingClientRect().bottom - parent.getBoundingClientRect().top + 10);
        };
        measure();
        const observer = overlay && typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
        observer?.observe(overlay);
        window.addEventListener("resize", measure);
        return () => {
            observer?.disconnect();
            window.removeEventListener("resize", measure);
        };
    }, []);

    return (
        <div className={styles.memoPanel} ref={panelRef} style={top != null ? { top } : undefined}>
            <div className={styles.memoFloatHeader}>
                <div className={styles.memoFloatTitle}>
                    <h3>메모</h3>
                    {list.length > 0 && <span className={styles.memoFloatCount}>{list.length}</span>}
                    {placeName && <div className={styles.memoFloatPlace}>{placeName}</div>}
                </div>
                <button className={styles.memoFloatClose} onClick={onClose} aria-label="닫기">×</button>
            </div>
            <div className={styles.memoFloatBody}>

            {list.map((memoGroup, idx) => {
                const color = memoColorFor(memoGroup.userId);
                const contents = Array.isArray(memoGroup.contents) ? memoGroup.contents : [];
                const isMine = !!userId && memoGroup.userId === userId;

                if (isMine && editingId === memoGroup.memoId) {
                    return (
                        <MemoForm
                            key={memoGroup.memoId ?? idx}
                            color={color}
                            initial={{
                                text: contents.find(c => c.type === "text")?.content,
                                link: contents.find(c => c.type === "link")?.content,
                                hasImage: contents.some(c => c.type === "image"),
                            }}
                            onSave={({ text, link }) => onUpdateInline({ memoId: memoGroup.memoId, text, link })}
                            onCancel={() => setEditingId(null)}
                        />
                    );
                }

                return (
                <div
                    key={memoGroup.memoId ?? idx}
                    className={styles.memoGroup}
                    style={{ background: color.bg, borderLeft: `4px solid ${color.accent}`, color: color.text }}
                >
                    <div className={styles.memoGroupHeader}>
                        <span className={styles.memoAuthor} style={{ background: color.accent }}>
                            {memoGroup.userId ? (isMine ? `${memoGroup.userId} (나)` : memoGroup.userId) : "이전 메모"}
                        </span>
                        {/* 본인 메모만 수정 가능 */}
                        {isMine && memoGroup.memoId && (
                            <button
                                className={styles.memoEditButton}
                                style={{ color: color.text }}
                                onClick={() => setEditingId(memoGroup.memoId)}
                                title="내 메모 수정"
                            >
                                ✎ 수정
                            </button>
                        )}
                    </div>

                    <ul>
                        {["image", "link", "text"].map(type =>
                            contents
                                .filter(c => c.type === type)
                                .map((c, i) => (
                                    <li key={`${type}-${i}`} className={styles.memoItem}>
                                        {type === "image" ? (
                                            <img src={c.content} alt="memo" className={styles.memoImage} />
                                        ) : type === "link" ? (
                                            <a href={c.content} target="_blank" rel="noopener noreferrer">{c.content}</a>
                                        ) : (
                                            <span style={{ whiteSpace: "pre-wrap" }}>{c.content}</span>
                                        )}
                                    </li>
                                ))
                        )}
                    </ul>
                </div>
                );
            })}

            {/* 사람당 메모는 1개만: 내 메모가 이미 있으면 새 메모 버튼을 숨긴다 */}
            {!myMemo && (drafting ? (
                <MemoForm color={myColor} onSave={onAddInline} onCancel={() => setDrafting(false)} />
            ) : (
                <button className={styles.memoDraftOpen} onClick={() => setDrafting(true)}>
                    + 내 메모 남기기
                </button>
            ))}
            </div>
        </div>
    );
};

export default MemoPanel;
