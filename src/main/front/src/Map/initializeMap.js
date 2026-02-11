import axios from "axios";
import { drawRouteByDay } from "./drawRouteByDay";

const initializeMap = async ({ mapRef, markerRef, markersRef, infoWindowRef, setMap }) => {
    window.registerToTimetable = async (lat, lon, name, address, restaurantId, image) => {
        const travelId = sessionStorage.getItem("selectedTravelId");
        const selectedDay = sessionStorage.getItem("selectedDay") || 1;

        if (!travelId) {
            alert("여행 ID가 설정되지 않았습니다.");
            return;
        }

        try {
            // 1. 새 장소 등록
            const payload = {
                place_id: 0,
                place_name: name,
                place_address: address,
                place_image: image || "",
                place_business_hour: "",
                place_holiday: "",
                place_stay_time: 60,
                next_place_id: null,
                place_visiting_time: "00:00:00",
                latitude: lat,
                longitude: lon,
                travelId: parseInt(travelId, 10),
                selected_day: parseInt(selectedDay, 10),
                mongo: restaurantId
            };

            const response = await axios.post("/place", payload);
            const createdPlace = response.data;
            const createdPlaceId = createdPlace.place_id;
            console.log("✅ 새로 생성된 장소 ID:", createdPlaceId);

            // 2. 기존 마지막 장소의 next_place_id 업데이트
            const allPlaces = await axios.get(`/place/travel/${travelId}`);
            const dayPlaces = allPlaces.data.filter(p =>
                p.selected_day === parseInt(selectedDay, 10)
                && p.place_id !== createdPlaceId
            );

            const lastPlace = dayPlaces.find(p => p.next_place_id === null);
            if (lastPlace) {
                const updatePayload = {
                    ...lastPlace,
                    next_place_id: createdPlaceId,
                    place_visiting_time: "00:00:00"
                };

                console.log("🔼 PUT /place/" + lastPlace.place_id);
                console.log("📦 updatePayload:", updatePayload);

                await axios.put(`/place/${lastPlace.place_id}`, updatePayload);
                console.log(`✅ next_place_id 업데이트 완료: ${lastPlace.place_id} → ${createdPlaceId}`);
            }

            alert("타임테이블에 등록되었습니다.");
            window.dispatchEvent(new Event("refresh-timetable"));

        } catch (err) {
            console.error("❌ 타임테이블 등록 실패:", err.response?.data || err);
            alert("등록 중 오류가 발생했습니다.");
        }
    };


    const script = document.createElement("script");
    script.src = "https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=7alfuu4tdn&submodules=geocoder";
    script.async = true;
    script.onload = async () => {
        if (window.naver) {
            const infoWindow = new window.naver.maps.InfoWindow({ anchorSkew: true });
            infoWindowRef.current = infoWindow;

            const travelId = sessionStorage.getItem("selectedTravelId");
            let centerLat = 36.1453; // 금오공대 위도
            let centerLng = 128.3939; // 금오공대 경도

            if (travelId) {
                try {
                    const res = await axios.get(`/place/travel/${travelId}`);
                    const places = res.data || [];

                    if (places.length > 0) {
                        centerLat = places[0].latitude;
                        centerLng = places[0].longitude;
                    }
                } catch (err) {
                    console.error("여행 장소 불러오기 실패:", err);
                }
            }

            const mapInstance = new window.naver.maps.Map("map", {
                center: new window.naver.maps.LatLng(centerLat, centerLng),
                zoom: 15,
            });

            mapRef.current = mapInstance;
            setMap(mapInstance);
        }
    };

    document.head.appendChild(script);
};

export default initializeMap;
