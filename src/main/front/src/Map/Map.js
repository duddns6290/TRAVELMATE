import React, { useRef, useState, useEffect } from "react";
import "./Map.css";
import PlaceRegister from "../Temp/PlaceRegister";
import initializeMap from "./initializeMap";
import { handleCategoryClick } from "./handleCategoryClick";
import { getScraps, loadScraps } from "./scrapStore";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { drawRouteByDay } from "./drawRouteByDay";
import MapSearch from "./MapSearch";
import { memoColorFor } from "../timetable/utils/memoColor";

// 스크랩 마커: 북마크 아이콘 + 스크랩한 사람 색 테두리 (여러 명이면 색을 나눠서)
const scrapPinIcon = (group) => {
    const users = [...new Set(group.map(s => s.userId || null))];
    const colors = users.map(u => memoColorFor(u).accent);
    const step = 100 / colors.length;
    const ring = colors.length === 1
        ? colors[0]
        : `conic-gradient(${colors.map((c, i) => `${c} ${i * step}% ${(i + 1) * step}%`).join(", ")})`;
    const title = `${group[0].name} · ${users.map(u => u || "이전").join(", ")} 스크랩`.replace(/[&<>"']/g, "");
    return {
        content: `
            <div class="tm-scrap-pin" style="background:${ring}" title="${title}">
                <div class="tm-scrap-pin-inner">🔖</div>
                ${users.length > 1 ? `<span class="tm-scrap-pin-count">${users.length}</span>` : ""}
            </div>`,
        anchor: new window.naver.maps.Point(17, 17),
    };
};

// 다른 사람이 정보창을 열어 보고 있는 가게 표시: "👀 user1 · 가게이름" 말풍선 (사람별 색)
const peerViewIcon = (userId, title) => {
    const { accent } = memoColorFor(userId);
    const clean = (v) => String(v).replace(/[&<>"']/g, "");
    return {
        content: `
            <div class="tm-peer-view" style="--peer-color:${accent}" title="눌러서 같이 보기">
                <span class="tm-peer-view-who">👀 ${clean(userId)}</span>
                <span class="tm-peer-view-title">${clean(title)}</span>
            </div>`,
        anchor: new window.naver.maps.Point(0, 88), // 가게 핀(높이 약 37px) 위쪽에 뜨도록
    };
};

// 다른 사람 커서 모양: 사람별 색 화살표 + 이름표 (화살표 끝이 좌표)
const cursorIcon = (userId) => {
    const { accent } = memoColorFor(userId);
    const name = String(userId).replace(/[&<>"']/g, "");
    return {
        content: `
            <div class="tm-cursor" style="--cursor-color:${accent}">
                <svg width="18" height="18" viewBox="0 0 18 18">
                    <path d="M2 1 L2 15 L6 11 L9 17 L11.5 16 L8.5 10 L14 10 Z"
                          fill="${accent}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>
                </svg>
                <span class="tm-cursor-name">${name}</span>
            </div>`,
        anchor: new window.naver.maps.Point(2, 1),
    };
};

const Map = ({ schedule, selectedDay, remoteCursors = {}, onCursorMove }) => {
    const { travelId } = useParams();
    const navigate = useNavigate();
    const polylinesRef = useRef([]);
    // 경로 번호 마커는 카테고리/검색 마커(markersRef)와 분리해서 관리한다.
    const routeMarkersRef = useRef([]);

    const mapRef = useRef(null);
    const markersRef = useRef([]);
    const markerRef = useRef(null);
    const infoWindowRef = useRef(null);

    const [map, setMap] = useState(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [showRegisterForm, setShowRegisterForm] = useState(false);
    const [showPlaceList, setShowPlaceList] = useState(false);

    // ===== 스크랩한 장소: 지도에 항상 표시 =====
    const [scrapList, setScrapList] = useState([]);
    useEffect(() => {
        const sync = () => setScrapList([...getScraps()]);
        window.addEventListener("scrap-changed", sync);
        if (travelId) loadScraps(travelId).catch(err => console.error("스크랩 불러오기 실패:", err));
        return () => window.removeEventListener("scrap-changed", sync);
    }, [travelId]);

    const scrapMarkersRef = useRef([]);
    useEffect(() => {
        if (!map) return;
        scrapMarkersRef.current.forEach(m => m.setMap(null));
        scrapMarkersRef.current = [];

        // 같은 장소(좌표)의 스크랩은 한 마커로 묶는다
        const groups = {};
        scrapList.forEach(s => {
            if (s.latitude == null || s.longitude == null) return;
            const key = `${s.latitude.toFixed(4)},${s.longitude.toFixed(4)}`;
            (groups[key] = groups[key] || []).push(s);
        });

        Object.values(groups).forEach(group => {
            const marker = new window.naver.maps.Marker({
                map,
                position: new window.naver.maps.LatLng(group[0].latitude, group[0].longitude),
                icon: scrapPinIcon(group),
                zIndex: 50,
            });
            // 누르면 스크랩 패널을 연다
            marker.addListener("click", () => window.openScrapPanel?.());
            scrapMarkersRef.current.push(marker);
        });
    }, [map, scrapList]);

    // ===== 다른 사람이 보고 있는 가게 =====
    const [peerViews, setPeerViews] = useState({}); // { [userId]: { category, lat, lon, searchLat, searchLon, placeId, title, ts } }
    useEffect(() => {
        const onRemote = (e) => {
            const { type, userId, ...view } = e.detail || {};
            if (!userId) return;
            setPeerViews(prev => {
                if (type === "MAP_PLACE_CLOSE") {
                    if (!prev[userId]) return prev;
                    const next = { ...prev };
                    delete next[userId];
                    return next;
                }
                return { ...prev, [userId]: { ...view, ts: Date.now() } };
            });
        };
        window.addEventListener("map-place-remote", onRemote);
        // 오래된 표시(2분)는 정리
        const timer = setInterval(() => {
            setPeerViews(prev => {
                const alive = Object.entries(prev).filter(([, v]) => Date.now() - v.ts < 120000);
                return alive.length === Object.keys(prev).length ? prev : Object.fromEntries(alive);
            });
        }, 10000);
        return () => {
            window.removeEventListener("map-place-remote", onRemote);
            clearInterval(timer);
        };
    }, []);

    const followPeerView = (view) => {
        if (!map) return;
        map.setCenter(new window.naver.maps.LatLng(view.lat, view.lon));
        // 그 사람과 같은 검색을 하고, 같은 가게 정보창을 연다
        handleCategoryClick(view.category, map, markersRef, infoWindowRef, {
            center: { lat: view.searchLat, lon: view.searchLon },
            openPlaceId: view.placeId,
        });
    };
    const followPeerViewRef = useRef(followPeerView);
    followPeerViewRef.current = followPeerView;

    const peerViewMarkersRef = useRef({});
    useEffect(() => {
        if (!map) return;
        const current = peerViewMarkersRef.current;
        Object.values(current).forEach(m => m.setMap(null));
        peerViewMarkersRef.current = {};
        Object.entries(peerViews).forEach(([uid, view]) => {
            if (view.lat == null || view.lon == null) return;
            const marker = new window.naver.maps.Marker({
                map,
                position: new window.naver.maps.LatLng(view.lat, view.lon),
                icon: peerViewIcon(uid, view.title),
                zIndex: 900,
            });
            marker.addListener("click", () => followPeerViewRef.current(view));
            peerViewMarkersRef.current[uid] = marker;
        });
    }, [map, peerViews]);

    // ===== 실시간 커서 =====
    // 내 마우스 위치를 위도/경도로 보낸다 (지도 밖으로 나가면 null)
    const onCursorMoveRef = useRef(onCursorMove);
    onCursorMoveRef.current = onCursorMove;
    useEffect(() => {
        if (!map) return;
        const { Event } = window.naver.maps;
        const moveListener = Event.addListener(map, "mousemove", (e) => {
            onCursorMoveRef.current?.({ lat: e.coord.y, lng: e.coord.x });
        });
        const outListener = Event.addListener(map, "mouseout", () => onCursorMoveRef.current?.(null));
        return () => Event.removeListener([moveListener, outListener]);
    }, [map]);

    // 다른 사람 커서를 지도 마커로 그린다 (사람별 색 + 이름표)
    const cursorMarkersRef = useRef({}); // { [userId]: { marker, lat, lng } }
    useEffect(() => {
        if (!map) return;
        const current = cursorMarkersRef.current;

        Object.entries(remoteCursors).forEach(([uid, c]) => {
            if (c.lat == null || c.lng == null) return;
            const existing = current[uid];
            if (existing && existing.lat === c.lat && existing.lng === c.lng) return;

            const position = new window.naver.maps.LatLng(c.lat, c.lng);
            // 내용을 새로 넣어야 "잠시 멈추면 흐려지는" CSS 애니메이션이 다시 시작된다
            const icon = cursorIcon(uid);
            if (existing) {
                existing.marker.setPosition(position);
                existing.marker.setIcon(icon);
                existing.lat = c.lat;
                existing.lng = c.lng;
            } else {
                const marker = new window.naver.maps.Marker({ map, position, icon, clickable: false, zIndex: 1000 });
                current[uid] = { marker, lat: c.lat, lng: c.lng };
            }
        });

        // 지도 밖으로 나갔거나 떠난 사람의 커서 제거
        Object.keys(current).forEach(uid => {
            const c = remoteCursors[uid];
            if (!c || c.lat == null || c.lng == null) {
                current[uid].marker.setMap(null);
                delete current[uid];
            }
        });
    }, [map, remoteCursors]);

    // 경로/번호 마커는 타임테이블 패널과 같은 schedule 상태로 그린다.
    // (등록·삭제·순서변경·다른 사용자 편집 모두 schedule이 바뀌면 자동으로 다시 그려짐)
    useEffect(() => {
        if (!map) return;

        routeMarkersRef.current.forEach(m => m.setMap(null));
        routeMarkersRef.current = [];
        polylinesRef.current.forEach(p => p.setMap(null));
        polylinesRef.current = [];

        drawRouteByDay(map, schedule?.[selectedDay], selectedDay, routeMarkersRef, polylinesRef);
    }, [map, schedule, selectedDay]);


    useEffect(() => {
        if (selectedDay) {
            sessionStorage.setItem("selectedDay", selectedDay);
        }
    }, [selectedDay]);

    useEffect(() => {
        if (!showPlaceList || !map || !travelId) return;

        axios.get(`/tempplace/travel/${travelId}`)
            .then(res => {
                const places = res.data;

                markersRef.current.forEach(marker => marker.setMap(null));
                markersRef.current = [];

                places.forEach(place => {
                    const position = new window.naver.maps.LatLng(place.latitude, place.longitude);
                    const marker = new window.naver.maps.Marker({
                        map,
                        position,
                    });

                    marker.addListener("click", () => {
                        console.log("클릭된 마커 ID:", place.id);
                        navigate(`/tempplace/${place.id}`);
                    });


                    markersRef.current.push(marker);
                });
            })
            .catch(err => {
                console.error("임시 장소 불러오기 실패:", err);
            });
    }, [showPlaceList, map, travelId]);


    useEffect(() => {
        if (travelId) {
            sessionStorage.setItem("selectedTravelId", travelId);
        }
    }, [travelId]);

    useEffect(() => {
        initializeMap({ mapRef, markerRef, markersRef, infoWindowRef, setMap });
    }, []);


    return (
        <div className="map-board">
            <div className="map-overlay">
                <div className="map-controls">
                    {/* 입력하면 아래에 관련 가게·주소가 뜨는 검색창 */}
                    <MapSearch map={map} infoWindowRef={infoWindowRef} />
                    <div className="map-buttons">
                        <button
                            className="button"
                            onClick={() =>
                                handleCategoryClick("restaurant", map, markersRef, infoWindowRef)
                            }
                        >
                            🍴 음식점
                        </button>

                        <button
                            className="button"
                            onClick={() => handleCategoryClick("cafe", map, markersRef, infoWindowRef)}
                        >
                            ☕ 카페
                        </button>
                        <button
                            className="button"
                            onClick={() => handleCategoryClick("lodging", map, markersRef, infoWindowRef)}
                        >
                            🛏️ 숙소
                        </button>
                        <button
                            className="button"
                            onClick={() => handleCategoryClick("attraction", map, markersRef, infoWindowRef)}
                        > 
                            📸 관광지
                        </button>
                    </div>
                </div>
            </div>

            <div id="map" className="map-container"></div>




        </div>
    );
};

export default Map;
