import axios from "axios";

export const handleCategoryClick = async (category, map, markersRef, infoWindowRef) => {
    if (!map) return;

    try {
        const center = map.getCenter();
        const lat = center.y;
        const lon = center.x;

        const travelId = parseInt(sessionStorage.getItem("selectedTravelId"), 10) || 0;
        if (!travelId) {
            alert("여행 ID가 없습니다.");
            return;
        }

        // 스크랩된 장소 목록 불러오기
        const scrapRes = await axios.get(`/tempplace/travel/${travelId}`);
        const savedPlaces = scrapRes.data;

        const isScrapped = (lat, lon) =>
            savedPlaces.some(p =>
                Math.abs(p.latitude - lat) < 0.0001 &&
                Math.abs(p.longitude - lon) < 0.0001
            );

        let places = [];

        if (["lodging", "attraction"].includes(category)) {
            const response = await axios.get("/restaurant/category/google", {
                params: { lat, lng: lon, keyword: category }
            });
            places = response.data.results.map((item, index) => ({
                id: `google_${index}`,
                title: item.name,
                address: item.formatted_address,
                lat: item.geometry.location.lat,
                lon: item.geometry.location.lng,
                source: "google",
            }));
        } else {
            const response = await axios.get("/restaurant/category", {
                params: { category, lat, lon, limit: 100, distanceKm: 10 }
            });
            places = response.data.map((item) => ({
                ...item,
                source: "internal",
            }));
        }

        if (!places.length) return alert("결과 없음");

        markersRef.current.forEach((m) => m.setMap(null));
        markersRef.current = [];

        places.forEach((place) => {
            const pos = new window.naver.maps.LatLng(place.lat, place.lon);
            const marker = new window.naver.maps.Marker({ map, position: pos });
            markersRef.current.push(marker);

            marker.addListener("click", async () => {
                let title = place.title || place.name || "장소 이름 없음";
                let address = place.address || place.formatted_address || "주소 정보 없음";
                let lat = place.lat || (place.geometry && place.geometry.location.lat);
                let lon = place.lon || (place.geometry && place.geometry.location.lng);
                let image = place.titleImg;

                if (place.source === "internal") {
                    try {
                        const res = await axios.get(`/restaurant/info/${place.id}`);
                        const detail = res.data;
                        title = detail.title || title;
                        address = detail.address || address;
                        lat = detail.lat || lat;
                        lon = detail.lon || lon;
                        image = detail.titleImg;
                    } catch (err) {
                        console.error("상세 정보 요청 실패", err);
                    }
                }

                const alreadyScrapped = isScrapped(lat, lon);

                const container = document.createElement("div");
                container.className = "info-window";
                container.innerHTML = `
    <div class="info-window">
        <div class="info-header" style="display: flex; justify-content: space-between; align-items: center;">
            <div class="info-title" style="font-weight: bold;">${title}</div>
            <div style="display: flex; gap: 6px; align-items: center;">
                <button id="scrap-btn" class="scrap-btn">${alreadyScrapped ? "★" : "☆"}</button>
                <button id="close-btn" style="
                    border: none;
                    background: none;
                    font-size: 16px;
                    font-weight: bold;
                    cursor: pointer;
                    color: #999;
                ">✖</button>
            </div>
        </div>
        <div class="info-address" style="margin: 6px 0;">${address}</div>
        <div class="info-buttons" style="display: flex; gap: 6px;">
            <button id="register-btn" class="register-btn">타임테이블 등록</button>
            ${place.source === "internal"
                    ? `<button id="detail-btn" class="detail-btn">상세 보기</button>`
                    : ""}
        </div>
    </div>
`;


                container.querySelector("#scrap-btn").addEventListener("click", async (e) => {
                    if (alreadyScrapped) {
                        alert("이미 스크랩된 장소입니다.");
                        return;
                    }

                    try {
                        const payload = {
                            name: title,
                            address: address,
                            image: image || "",
                            businessHour: "",
                            holiday: "",
                            latitude: lat,
                            longitude: lon,
                            travelId
                        };

                        await axios.post("/tempplace", payload, {
                            headers: {
                                "Content-Type": "application/json"
                            }
                        });

                        e.target.innerText = "★";
                        alert("스크랩 완료!");
                    } catch (err) {
                        console.error("스크랩 실패", err);
                        alert("스크랩 중 오류가 발생했습니다.");
                    }
                });

                container.querySelector("#register-btn").addEventListener("click", () => {
                    window.registerToTimetable(lat, lon, title, address, place.id || "google", image);
                });

                if (place.source === "internal") {
                    container.querySelector("#detail-btn").addEventListener("click", () => {
                        window.location.href = `/place/${place.id}`;
                    });
                }

                if (!infoWindowRef || !infoWindowRef.current) {
                    infoWindowRef = { current: new window.naver.maps.InfoWindow() };
                }

                infoWindowRef.current.setContent(container);
                infoWindowRef.current.open(map, marker);

                // 여기에서 닫기 버튼 이벤트 등록
                container.querySelector("#close-btn").addEventListener("click", () => {
                    if (infoWindowRef?.current) {
                        infoWindowRef.current.close();
                    }
                });
            });
        });
    } catch (err) {
        console.error("카테고리 요청 실패", err);
    }
};
