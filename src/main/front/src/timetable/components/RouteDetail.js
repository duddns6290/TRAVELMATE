import React, { useEffect, useState } from "react";
import axios from "axios";
import styles from "../Timetable.module.css";

const STEP_ICON = { WALKING: "🚶", BUS: "🚌", SUBWAY: "🚇", TRAIN: "🚆", EXPRESSBUS: "🚍", INTERCITYBUS: "🚍", FERRY: "⛴️", AIRPLANE: "✈️" };
const stepIcon = (type) => STEP_ICON[type] || "🚌";

// 대중교통 경로 후보 캐시
const optionsCache = {};

// 이동시간 칸을 누르면 바로 아래에 뜨는 작은 카드:
//  - 대중교통: 어떤 버스/지하철을 어디서 타서 몇 분 가는지 (후보 최대 3개)
//  - 도보/자동차: 시간·거리 요약
//  - "길찾기" 버튼 → 네이버 지도 길찾기
const RouteDetail = ({ from, to, onClose }) => {
    const isTransit = (from.type || "").includes("대중교통");
    const cacheKey = `${from.id}->${to.id}`;
    const [options, setOptions] = useState(isTransit ? optionsCache[cacheKey] ?? null : []);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (!isTransit || optionsCache[cacheKey]) return;
        axios.get("http://localhost:8080/api/route/transit-options", {
            params: {
                fromName: from.name, fromLat: from.latitude, fromLon: from.longitude,
                toName: to.name, toLat: to.latitude, toLon: to.longitude,
                limit: 3,
            },
        })
            .then(res => {
                optionsCache[cacheKey] = res.data || [];
                setOptions(optionsCache[cacheKey]);
            })
            .catch(() => {
                setFailed(true);
                setOptions([]);
            });
    }, [isTransit, cacheKey]); // eslint-disable-line react-hooks/exhaustive-deps

    const openDirections = () => {
        if (from.placeUrl) window.open(from.placeUrl, "_blank", "noopener");
    };

    return (
        <div className={styles.routeDetail} onClick={e => e.stopPropagation()}>
            <div className={styles.routeDetailHeader}>
                <span>{from.name} → {to.name}</span>
                <button className={styles.routeDetailClose} onClick={onClose} aria-label="닫기">×</button>
            </div>

            {!from.type ? (
                <div className={styles.routeDetailEmpty}>편집에서 이동수단(자동차·도보·대중교통)을 골라주세요.</div>
            ) : !isTransit ? (
                <div className={styles.routeSummary}>
                    <span className={styles.routeSummaryMain}>{from.type}</span>
                    <span>{from.travelTime}</span>
                </div>
            ) : options === null ? (
                <div className={styles.routeDetailEmpty}>경로를 불러오는 중...</div>
            ) : options.length === 0 ? (
                <div className={styles.routeDetailEmpty}>
                    {failed ? "경로 정보를 가져오지 못했어요." : "대중교통 경로가 없어요. (너무 가까우면 걸어가는 게 빨라요)"}
                </div>
            ) : (
                <div className={styles.routeOptions}>
                    {options.map((opt, i) => {
                        const rides = opt.steps.filter(s => s.type !== "WALKING");
                        return (
                            <div key={i} className={`${styles.routeOption} ${i === 0 ? styles.routeOptionBest : ""}`}>
                                <div className={styles.routeOptionTop}>
                                    <b>{opt.duration}분</b>
                                    <span className={styles.routeOptionMeta}>
                                        도보 {opt.walkingDuration}분 · {opt.transferCount ? `환승 ${opt.transferCount}회` : "환승 없음"}
                                    </span>
                                    {i === 0 && <span className={styles.routeBestTag}>추천</span>}
                                </div>

                                {/* 한 줄 요약: 🚶1 › 🚌 910-1 › 🚌 181 › 🚶5 */}
                                <div className={styles.routeChips}>
                                    {opt.steps.map((s, k) => (
                                        <React.Fragment key={k}>
                                            {k > 0 && <span className={styles.routeArrow}>›</span>}
                                            <span className={`${styles.routeChip} ${s.type === "WALKING" ? styles.routeChipWalk : ""}`}>
                                                {stepIcon(s.type)} {s.type === "WALKING" ? `${s.duration}분` : (s.routes[0] || s.type)}
                                            </span>
                                        </React.Fragment>
                                    ))}
                                </div>

                                {/* 탈것마다: 어디서 타서 어디서 내리는지 */}
                                {rides.map((s, k) => (
                                    <div key={k} className={styles.routeRide}>
                                        <span className={styles.routeRideName}>
                                            {stepIcon(s.type)} {s.routes.slice(0, 3).join(", ") || s.type}
                                            {s.routes.length > 3 && ` 외 ${s.routes.length - 3}`}
                                        </span>
                                        <span className={styles.routeRideInfo}>
                                            {s.from} → {s.to}
                                            {s.stopCount ? ` · ${s.stopCount}정거장` : ""} · {s.duration}분
                                        </span>
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            )}

            <button className={styles.routeGoButton} onClick={openDirections} disabled={!from.placeUrl}>
                🧭 길찾기
            </button>
        </div>
    );
};

export default RouteDetail;
