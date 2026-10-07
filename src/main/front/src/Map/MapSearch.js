import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { openPlaceInfo } from "./handleCategoryClick";
import { getCurrentUserId } from "./scrapStore";

// 지도 검색창: 입력하면 아래에 관련 가게(가까운 순)와 주소 후보가 뜨고, 고르면 그 위치로 이동해 정보창을 연다.

const distanceKm = (a, b) => {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLon = ((b.lon - a.lon) * Math.PI) / 180;
    const x = Math.sin(dLat / 2) ** 2 +
        Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
};

const formatDistance = (km) => (km == null ? "" : km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`);

// 가게: 새 검색 API(가까운 순, 주소 포함) → 없으면(서버 재시작 전) 기존 자동완성으로 대체
const searchPlaces = async (keyword, center) => {
    try {
        const res = await axios.get("/restaurant/search", {
            params: { keyword, lat: center.lat, lon: center.lon, limit: 6 },
        });
        return (res.data || []).map(p => ({ ...p, lat: Number(p.lat), lon: Number(p.lon) }));
    } catch (err) {
        if (err.response?.status !== 404) throw err;
        const res = await axios.get("/restaurant/autosearch", { params: { keyword, limit: 30 } });
        return (res.data || [])
            .map(p => ({ ...p, lat: Number(p.lat), lon: Number(p.lon) }))
            .map(p => ({ ...p, distanceKm: distanceKm(center, p) }))
            .sort((a, b) => a.distanceKm - b.distanceKm)
            .slice(0, 6);
    }
};

// 주소: 네이버 지오코더 후보 (가까운 순)
const searchAddresses = (query, center) =>
    new Promise((resolve) => {
        const service = window.naver?.maps?.Service;
        if (!service) return resolve([]);
        service.geocode({ query }, (status, response) => {
            if (status !== service.Status.OK) return resolve([]);
            resolve((response.v2?.addresses || [])
                .map(a => ({ road: a.roadAddress, jibun: a.jibunAddress, lat: parseFloat(a.y), lon: parseFloat(a.x) }))
                .map(a => ({ ...a, distanceKm: distanceKm(center, a) }))
                .sort((a, b) => a.distanceKm - b.distanceKm)
                .slice(0, 4));
        });
    });

const MapSearch = ({ map, infoWindowRef }) => {
    const [query, setQuery] = useState("");
    const [places, setPlaces] = useState([]);
    const [addresses, setAddresses] = useState([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [activeIdx, setActiveIdx] = useState(-1);
    const searchMarkerRef = useRef(null);
    const reqIdRef = useRef(0);

    const items = [
        ...places.map(p => ({ kind: "place", data: p })),
        ...addresses.map(a => ({ kind: "address", data: a })),
    ];

    useEffect(() => {
        const q = query.trim();
        if (!q || !map) {
            setPlaces([]);
            setAddresses([]);
            return;
        }
        const reqId = ++reqIdRef.current;
        setLoading(true);
        const t = setTimeout(async () => {
            const c = map.getCenter();
            const center = { lat: c.y, lon: c.x };
            const [p, a] = await Promise.all([
                searchPlaces(q, center).catch(() => []),
                searchAddresses(q, center),
            ]);
            if (reqId !== reqIdRef.current) return; // 더 최근 입력이 있으면 버림
            setPlaces(p);
            setAddresses(a);
            setActiveIdx(-1);
            setLoading(false);
        }, 250);
        return () => clearTimeout(t);
    }, [query, map]);

    const select = (item) => {
        if (!map || !item) return;
        const d = item.data;
        const position = new window.naver.maps.LatLng(d.lat, d.lon);
        map.setCenter(position);
        map.setZoom(16);

        // 검색 위치 표시 마커 (한 개만)
        searchMarkerRef.current?.setMap(null);
        const marker = new window.naver.maps.Marker({
            map,
            position,
            zIndex: 800,
            icon: {
                content: `<div class="tm-search-pin"><div class="tm-search-pin-head"><span style="transform:rotate(45deg)">🔍</span></div></div>`,
                anchor: new window.naver.maps.Point(17, 37),
            },
        });
        searchMarkerRef.current = marker;

        const place = item.kind === "place"
            ? { id: d.id, title: d.title, address: d.address, lat: d.lat, lon: d.lon, titleImg: d.titleImg, source: "internal" }
            : { id: null, title: d.road || d.jibun, address: d.road || d.jibun, lat: d.lat, lon: d.lon, source: "address" };

        openPlaceInfo({
            map,
            marker,
            infoWindowRef,
            place,
            travelId: parseInt(sessionStorage.getItem("selectedTravelId"), 10) || 0,
            me: getCurrentUserId(),
        });

        setQuery(item.kind === "place" ? d.title : (d.road || d.jibun));
        setOpen(false);
    };

    const onKeyDown = (e) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActiveIdx(i => Math.min(i + 1, items.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIdx(i => Math.max(i - 1, 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            select(items[activeIdx >= 0 ? activeIdx : 0]);
        } else if (e.key === "Escape") {
            setOpen(false);
        }
    };

    const showList = open && query.trim() && (items.length > 0 || !loading);
    let idx = -1;

    return (
        <div className="tm-search">
            <div className="tm-search-field">
                <span className="tm-search-icon">🔍</span>
                <input
                    className="tm-search-input"
                    placeholder="가게 이름이나 주소를 검색하세요"
                    value={query}
                    onChange={e => {
                        setQuery(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    onBlur={() => setTimeout(() => setOpen(false), 150)}
                    onKeyDown={onKeyDown}
                />
                {query && (
                    <button
                        className="tm-search-clear"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => {
                            setQuery("");
                            searchMarkerRef.current?.setMap(null);
                        }}
                        aria-label="지우기"
                    >×</button>
                )}
            </div>

            {showList && (
                <div className="tm-search-results">
                    {places.length > 0 && <div className="tm-search-section">장소</div>}
                    {places.map(p => {
                        idx += 1;
                        const i = idx;
                        return (
                            <div
                                key={`p-${p.id}`}
                                className={`tm-search-item ${i === activeIdx ? "is-active" : ""}`}
                                onMouseDown={e => e.preventDefault()}
                                onMouseEnter={() => setActiveIdx(i)}
                                onClick={() => select({ kind: "place", data: p })}
                            >
                                <span className="tm-search-item-icon">🍴</span>
                                <div className="tm-search-item-text">
                                    <div className="tm-search-item-title">{p.title}</div>
                                    {p.address && <div className="tm-search-item-sub">{p.address}</div>}
                                </div>
                                <span className="tm-search-item-dist">{formatDistance(p.distanceKm)}</span>
                            </div>
                        );
                    })}

                    {addresses.length > 0 && <div className="tm-search-section">주소</div>}
                    {addresses.map((a, k) => {
                        idx += 1;
                        const i = idx;
                        return (
                            <div
                                key={`a-${k}`}
                                className={`tm-search-item ${i === activeIdx ? "is-active" : ""}`}
                                onMouseDown={e => e.preventDefault()}
                                onMouseEnter={() => setActiveIdx(i)}
                                onClick={() => select({ kind: "address", data: a })}
                            >
                                <span className="tm-search-item-icon">📍</span>
                                <div className="tm-search-item-text">
                                    <div className="tm-search-item-title">{a.road || a.jibun}</div>
                                    {a.road && a.jibun && <div className="tm-search-item-sub">지번 {a.jibun}</div>}
                                </div>
                                <span className="tm-search-item-dist">{formatDistance(a.distanceKm)}</span>
                            </div>
                        );
                    })}

                    {!loading && items.length === 0 && (
                        <div className="tm-search-empty">검색 결과가 없어요</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MapSearch;
