import React, { useEffect, useRef, useState } from "react";
import styles from "../Timetable.module.css";
import { getCoordinatesFromAddress } from "../utils/PlacesUtil";

// 네이버 지오코더로 주소 후보 검색 (예: "대학로61" → 경북 구미시 대학로 61 ...)
const searchAddresses = (query) =>
    new Promise((resolve) => {
        const service = window.naver?.maps?.Service;
        if (!service) return resolve([]);
        service.geocode({ query }, (status, response) => {
            if (status !== service.Status.OK) return resolve([]);
            resolve((response.v2?.addresses || []).map(a => ({
                road: a.roadAddress,
                jibun: a.jibunAddress,
                lat: parseFloat(a.y),
                lng: parseFloat(a.x),
            })));
        });
    });

// "원하는 장소가 없다면" 버튼 바로 위에 뜨는 장소 직접 추가 창
// anchor: 이 여행 장소 좌표 {lat, lng} — 가까운 주소가 먼저 오도록 정렬 기준
const AddPlacePopover = ({ onClose, anchor }) => {
    const [name, setName] = useState("");
    const [address, setAddress] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const nameRef = useRef(null);

    // 주소 자동완성
    const [suggestions, setSuggestions] = useState([]);
    const [picked, setPicked] = useState(null); // 선택한 후보 { lat, lng } → 저장 시 다시 변환하지 않음
    const [activeIdx, setActiveIdx] = useState(-1);
    useEffect(() => {
        const q = address.trim();
        if (picked || q.length < 2) {
            setSuggestions([]);
            return;
        }
        const t = setTimeout(async () => {
            let list = await searchAddresses(q);
            if (anchor) {
                const dist = (s) => (s.lat - anchor.lat) ** 2 + (s.lng - anchor.lng) ** 2;
                list = [...list].sort((a, b) => dist(a) - dist(b));
            }
            setSuggestions(list);
            setActiveIdx(-1);
        }, 300);
        return () => clearTimeout(t);
    }, [address, picked, anchor?.lat, anchor?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

    const pickSuggestion = (s) => {
        setAddress(s.road || s.jibun);
        setPicked({ lat: s.lat, lng: s.lng });
        setSuggestions([]);
    };

    useEffect(() => {
        nameRef.current?.focus();
    }, []);

    const canSave = name.trim() && address.trim() && !saving;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!canSave) return;
        setSaving(true);
        setError("");
        try {
            // 주소 → 좌표 변환 후 현재 선택한 날짜 타임라인에 추가
            const { lat, lng } = picked || await getCoordinatesFromAddress(address.trim());
            const ok = await window.registerToTimetable?.(lat, lng, name.trim(), address.trim());
            if (ok) {
                onClose();
                return;
            }
            setError("타임테이블에 추가하지 못했어요. 다시 시도해주세요.");
        } catch (err) {
            console.error("장소 직접 추가 실패:", err);
            setError("주소를 찾을 수 없어요. 도로명 주소로 다시 입력해보세요.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <form
            className={styles.addPlacePopover}
            onSubmit={handleSubmit}
            onKeyDown={(e) => e.key === "Escape" && onClose()}
        >
            <div className={styles.addPlaceHeader}>
                <span>장소 직접 추가</span>
                <button type="button" className={styles.addPlaceClose} onClick={onClose} aria-label="닫기">×</button>
            </div>

            <input
                ref={nameRef}
                className={styles.addPlaceInput}
                placeholder="장소 이름 (예: 할머니 국밥)"
                value={name}
                onChange={e => setName(e.target.value)}
            />
            <div className={styles.addressField}>
                <input
                    className={styles.addPlaceInput}
                    placeholder="📍 주소 검색 (예: 대학로61)"
                    value={address}
                    onChange={e => {
                        setAddress(e.target.value);
                        setPicked(null);
                    }}
                    onKeyDown={e => {
                        if (!suggestions.length) return;
                        if (e.key === "ArrowDown") {
                            e.preventDefault();
                            setActiveIdx(i => Math.min(i + 1, suggestions.length - 1));
                        } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setActiveIdx(i => Math.max(i - 1, 0));
                        } else if (e.key === "Enter" && activeIdx >= 0) {
                            e.preventDefault();
                            pickSuggestion(suggestions[activeIdx]);
                        } else if (e.key === "Escape") {
                            e.stopPropagation();
                            setSuggestions([]);
                        }
                    }}
                />
                {suggestions.length > 0 && (
                    <ul className={styles.addressSuggestions}>
                        {suggestions.map((s, i) => (
                            <li
                                key={`${s.road}-${s.jibun}-${i}`}
                                className={i === activeIdx ? styles.addressSuggestionActive : ""}
                                onMouseDown={(e) => {
                                    e.preventDefault(); // 입력칸 포커스 유지
                                    pickSuggestion(s);
                                }}
                            >
                                <div className={styles.addressRoad}>{s.road || s.jibun}</div>
                                {s.road && s.jibun && <div className={styles.addressJibun}>지번 {s.jibun}</div>}
                            </li>
                        ))}
                    </ul>
                )}
                {picked && <span className={styles.addressPicked}>✓</span>}
            </div>

            {error && <div className={styles.addPlaceError}>{error}</div>}

            <button type="submit" className={styles.addPlaceSubmit} disabled={!canSave}>
                {saving ? "추가하는 중..." : "타임라인에 추가"}
            </button>
        </form>
    );
};

export default AddPlacePopover;
