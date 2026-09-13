import React, { useRef, useState, useEffect } from "react";
import "./Map.css";
import PlaceRegister from "../Temp/PlaceRegister";
import initializeMap from "./initializeMap";
import { handleCategoryClick } from "./handleCategoryClick";
import {
    handleSearchInputChange,
    handleSearchKeyDown,
    searchAddressToCoordinate
} from "./SearchHandler";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { drawRouteByDay } from "./drawRouteByDay";
import AutocompleteList from "./AutocompleteList";

const Map = ({ selectedDay }) => {
    const { travelId } = useParams();
    const navigate = useNavigate();
    const polylinesRef = useRef([]);

    const mapRef = useRef(null);
    const markersRef = useRef([]);
    const markerRef = useRef(null);
    const infoWindowRef = useRef(null);

    const [map, setMap] = useState(null);
    const [searchText, setSearchText] = useState("");
    const [autocompleteList, setAutocompleteList] = useState([]);
    const [menuOpen, setMenuOpen] = useState(false);
    const [showRegisterForm, setShowRegisterForm] = useState(false);
    const [showPlaceList, setShowPlaceList] = useState(false);

    useEffect(() => {
        const handleRefresh = async () => {
            const travelId = sessionStorage.getItem("selectedTravelId");
            const selectedDay = sessionStorage.getItem("selectedDay");

            if (!map || !travelId || !selectedDay) return;

            try {
                const res = await axios.get(`/place/travel/${travelId}`);
                const places = res.data || [];

                // 기존 마커, 라인 제거
                markersRef.current.forEach(marker => marker.setMap(null));
                markersRef.current = [];
                polylinesRef.current.forEach(polyline => polyline.setMap(null));
                polylinesRef.current = [];

                drawRouteByDay(map, places, parseInt(selectedDay), markersRef, polylinesRef);
            } catch (err) {
                console.error("refresh-timetable 이벤트 핸들링 실패", err);
            }
        };

        window.addEventListener("refresh-timetable", handleRefresh);
        return () => window.removeEventListener("refresh-timetable", handleRefresh);
    }, [map]);


    const handleSelectAutocompletePlace = (item) => {
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        const position = new window.naver.maps.LatLng(lat, lon);

        // 지도 이동
        map.setCenter(position);

        if (markerRef.current) markerRef.current.setMap(null);

        const marker = new window.naver.maps.Marker({
            map,
            position,
        });
        markerRef.current = marker;

        if (infoWindowRef.current) infoWindowRef.current.close();

        const infoWindow = new window.naver.maps.InfoWindow({
            content: `
            <div style="padding:10px; font-size:14px;">
                <strong>${item.title}</strong><br/>
                ${item.address || ""}
            </div>
        `,
        });
        infoWindow.open(map, marker);
        infoWindowRef.current = infoWindow;

        setAutocompleteList([]);
        setSearchText(item.title);
    };
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
    useEffect(() => {
        const handleRedrawRoute = async (e) => {
            const travelId = sessionStorage.getItem("selectedTravelId");
            const day = e?.detail?.day ?? sessionStorage.getItem("selectedDay");

            if (!map || !travelId || !day) return;

            console.log(`🔁 [${day}일차] 경로 다시 그리는 중...`);

            try {
                const res = await axios.get(`/place/travel/${travelId}`);
                const places = res.data || [];

                markersRef.current.forEach(m => m.setMap(null));
                markersRef.current = [];
                polylinesRef.current.forEach(p => p.setMap(null));
                polylinesRef.current = [];

                drawRouteByDay(map, places, parseInt(day), markersRef, polylinesRef);

                console.log(`✅ [${day}일차] 경로 다시 그림 완료`);
            } catch (err) {
                console.error("❌ 경로 다시 그리기 실패:", err);
            }
        };


        window.addEventListener("refresh-map-route", handleRedrawRoute);
        return () => window.removeEventListener("refresh-map-route", handleRedrawRoute);
    }, [map]);

    useEffect(() => {
        const travelId = sessionStorage.getItem("selectedTravelId");

        if (map && travelId && selectedDay) {
            axios.get(`/place/travel/${travelId}`)
                .then((res) => {
                    const places = res.data || [];

                    // 기존 경로/마커 제거
                    markersRef.current.forEach((m) => m.setMap(null));
                    markersRef.current = [];
                    polylinesRef.current.forEach((p) => p.setMap(null));
                    polylinesRef.current = [];

                    drawRouteByDay(map, places, selectedDay, markersRef, polylinesRef);
                })
                .catch((err) => {
                    console.error("경로 불러오기 실패:", err);
                });
        }
    }, [map, selectedDay]); // ✅ selectedDay 상태로 감지



    return (
        <div className="map-board">
            <div className="map-overlay">
                <div className="map-controls">
                    <div className="search-box" style={{ position: "relative" }}>
                        <input
                            type="text"
                            placeholder="주소 또는 장소 검색"
                            className="search-input"
                            value={searchText}
                            onChange={(e) =>
                                handleSearchInputChange(e, setSearchText, setAutocompleteList)
                            }
                            onKeyDown={(e) =>
                                handleSearchKeyDown(
                                    e,
                                    autocompleteList,
                                    setSearchText,
                                    setAutocompleteList,
                                    map,
                                    markersRef
                                )
                            }
                        />
                        <button
                            className="search-clear"
                            onClick={() =>
                                searchAddressToCoordinate(searchText, map, markerRef)
                            }
                        >
                            검색
                        </button>
                        {autocompleteList.length > 0 && (
                            <AutocompleteList
                                list={autocompleteList}
                                onSelectPlace={handleSelectAutocompletePlace}
                            />
                        )}

                    </div>
                    <div className="map-buttons">
                        <button
                            className="button"
                            onClick={() =>
                                handleCategoryClick("restaurant", map, markersRef, infoWindowRef)
                            }
                        >
                            음식점
                        </button>

                        <button
                            className="button"
                            onClick={() => handleCategoryClick("cafe", map, markersRef)}
                        >
                            카페
                        </button>
                        <button
                            className="button"
                            onClick={() => handleCategoryClick("lodging", map, markersRef)}
                        >
                            숙소
                        </button>
                        <button
                            className="button"
                            onClick={() => handleCategoryClick("attraction", map, markersRef)}
                        > 
                            관광지
                        </button>
                    </div>
                </div>
            </div>

            <div id="map" className="map-container"></div>



        </div>
    );
};

export default Map;
