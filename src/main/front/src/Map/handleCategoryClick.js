import axios from "axios";
import { memoColorFor } from "../timetable/utils/memoColor";
import { addScrap, getCurrentUserId, loadScraps, removeScrap, scrapsAt } from "./scrapStore";

const escapeHtml = (str = "") =>
    String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// 카테고리별 커스텀 핀 (물방울 모양 + 아이콘). 기본 네이버 마커 대신 사용한다.
const PIN_STYLE = {
    restaurant: { color: "#ff7a59", icon: "🍴" },
    cafe: { color: "#a9795b", icon: "☕" },
    lodging: { color: "#7c6cf0", icon: "🛏️" },
    attraction: { color: "#2fb58c", icon: "📸" },
};

// 스크랩한 사람이 있으면 핀 오른쪽 위에 그 사람 색 배지(여러 명이면 겹쳐서)를 붙인다
const categoryPinIcon = (category, scrappers = []) => {
    const { color, icon } = PIN_STYLE[category] || { color: "#4a78d6", icon: "📍" };
    const badges = [...new Set(scrappers.map(s => s.userId || null))]
        .slice(0, 3)
        .map((u, i) => `<span class="tm-pin-badge" style="background:${memoColorFor(u).accent};right:${-4 + i * 7}px"></span>`)
        .join("");
    return {
        content: `
            <div class="tm-pin" style="--pin-color:${color}">
                <div class="tm-pin-head"><span class="tm-pin-icon">${icon}</span></div>
                ${badges}
            </div>`,
        size: new window.naver.maps.Size(34, 42),
        anchor: new window.naver.maps.Point(17, 37), // 물방울 뾰족한 끝(약 y=36)이 좌표를 가리키도록
    };
};

// 내 정보창 닫힘 감시 리스너 (하나만 유지)
let placeCloseWatch = null;

// 현재 지도에 떠 있는 카테고리 핀들 (스크랩이 바뀌면 배지를 다시 그린다)
let activePins = [];
window.addEventListener("scrap-changed", () => {
    activePins.forEach(({ marker, category, lat, lon }) => {
        marker.setIcon(categoryPinIcon(category, scrapsAt(lat, lon)));
    });
});

// 정보창의 스크랩 줄: [＋ 스크랩 / ✓ 스크랩됨] 버튼 + 다른 사람 스크랩 표시
const renderScrapRow = (row, { me, lat, lon, payload }) => {
    const here = scrapsAt(lat, lon);
    const mine = here.find(s => (s.userId || null) === me);
    const others = [...new Set(here.filter(s => s !== mine).map(s => s.userId || null))];
    const myColor = memoColorFor(me);

    row.innerHTML = `
        <button class="tm-scrap-btn ${mine ? "is-on" : ""}"
                style="--scrap-color:${myColor.accent}"
                title="${mine ? "눌러서 스크랩 취소" : "스크랩한 장소에 저장"}">
            ${mine ? "✓ 스크랩됨" : "＋ 스크랩"}
        </button>
        ${others.map(u => {
            const c = memoColorFor(u);
            return `<span class="tm-scrapper" style="background:${c.bg};color:${c.text};border-color:${c.accent}">
                        <i style="background:${c.accent}"></i>${escapeHtml(u || "이전")}
                    </span>`;
        }).join("")}
    `;

    const btn = row.querySelector(".tm-scrap-btn");
    btn.addEventListener("click", async () => {
        if (btn.dataset.saving) return;
        btn.dataset.saving = "1";
        btn.disabled = true;
        try {
            if (mine) await removeScrap(mine);
            else await addScrap({ ...payload, userId: me });
            // scrap-changed 이벤트로 다시 그려진다
        } catch (err) {
            console.error("스크랩 처리 실패", err);
            alert(err.response?.status === 403 ? "본인이 스크랩한 장소만 취소할 수 있어요." : "스크랩 중 오류가 발생했습니다.");
            btn.disabled = false;
            delete btn.dataset.saving;
        }
    });
};


// 장소 정보창 열기 (카테고리 핀, 지도 검색 결과 공용).
// place: { id, title|name, address, lat, lon, titleImg, source: "internal"|"google"|"address" }
// category: 카테고리 검색에서 연 경우 그 카테고리 (다른 사람이 따라 볼 때 같은 검색을 재현), 검색창에서 연 경우 null
export const openPlaceInfo = async ({ map, marker, infoWindowRef, place, category = null, searchCenter = null, travelId, me }) => {
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

    const container = document.createElement("div");
    container.className = "tm-info";
    container.innerHTML = `
    ${image ? `<div class="tm-info-thumb" style="background-image:url('${escapeHtml(image)}')"></div>` : ""}
    <div class="tm-info-body">
        <div class="tm-info-header">
<div class="tm-info-title">${escapeHtml(title)}</div>
<div class="tm-info-actions">
    <button id="close-btn" class="tm-info-icon tm-info-close" title="닫기">×</button>
</div>
        </div>
        <div class="tm-info-address">📍 ${escapeHtml(address)}</div>
        <div class="tm-scrap-row"></div>
        <div class="tm-info-buttons">
<button id="register-btn" class="tm-info-btn tm-info-btn-primary">타임테이블 등록</button>
${place.source === "internal"
        ? `<button id="detail-btn" class="tm-info-btn tm-info-btn-ghost">상세 보기</button>`
        : ""}
        </div>
    </div>
`;

    // 스크랩 줄: 처음 그리고, 스크랩이 바뀌면(내 클릭/다른 사람 소켓) 다시 그린다
    const scrapRow = container.querySelector(".tm-scrap-row");
    const scrapCtx = {
        me,
        lat,
        lon,
        payload: {
            name: title,
            address,
            image: image || "",
            businessHour: "",
            holiday: "",
            latitude: lat,
            longitude: lon,
            travelId,
            // 상세정보가 있는 식당이면 id를 같이 저장 → 타임테이블로 옮겨도 상세 보기 가능
            restaurantId: place.source === "internal" ? place.id : null,
        },
    };
    renderScrapRow(scrapRow, scrapCtx);
    const onScrapChanged = () => {
        if (!container.isConnected) {
            window.removeEventListener("scrap-changed", onScrapChanged);
            return;
        }
        renderScrapRow(scrapRow, scrapCtx);
    };
    window.addEventListener("scrap-changed", onScrapChanged);

    container.querySelector("#register-btn").addEventListener("click", async () => {
        const mongoId = place.source === "internal" ? place.id : null; // 구글/주소 결과는 상세정보 id 없음
        await window.registerToTimetable(lat, lon, title, address, mongoId, image);
        // 등록 알림 대신 정보창을 닫아 타임라인/지도에 추가된 것을 바로 보이게 한다
        infoWindowRef?.current?.close();
    });

    if (place.source === "internal") {
        container.querySelector("#detail-btn").addEventListener("click", () => {
            // 타임라인 옆 상세 패널로 연다
            window.openPlaceDetail?.(place.id);
        });
    }

    if (!infoWindowRef || !infoWindowRef.current) {
        infoWindowRef = { current: new window.naver.maps.InfoWindow() };
    }
    // 기본 흰 테두리/배경을 없애고 카드(.tm-info) 자체 스타일로 보이게 한다.
    infoWindowRef.current.setOptions({
        borderWidth: 0,
        backgroundColor: "transparent",
        anchorSize: new window.naver.maps.Size(14, 10),
        anchorColor: "#ffffff",
        anchorSkew: true,
        pixelOffset: new window.naver.maps.Point(0, -6),
    });

    infoWindowRef.current.setContent(container);
    infoWindowRef.current.open(map, marker);

    // 내가 보고 있는 가게를 같은 여행 사람들에게 알린다 (검색 중심도 같이 보내 따라 볼 수 있게)
    window.broadcastTravelEvent?.("MAP_PLACE_OPEN", {
        category, lat, lon: lon, searchLat: searchCenter?.lat ?? lat, searchLon: searchCenter?.lon ?? lon,
        placeId: place.id, title,
        place: { id: place.id, title, address, lat, lon, titleImg: image || null, source: place.source },
    });
    // 정보창이 닫히면 알림 해제 (지원되면 close 이벤트, 아니면 × 버튼에서)
    if (placeCloseWatch) window.naver.maps.Event.removeListener(placeCloseWatch);
    placeCloseWatch = window.naver.maps.Event.addListener(infoWindowRef.current, "close", () => {
        window.naver.maps.Event.removeListener(placeCloseWatch);
        placeCloseWatch = null;
        window.broadcastTravelEvent?.("MAP_PLACE_CLOSE", { placeId: place.id });
    });

    container.querySelector("#close-btn").addEventListener("click", () => {
        if (infoWindowRef?.current) {
            infoWindowRef.current.close();
        }
        window.broadcastTravelEvent?.("MAP_PLACE_CLOSE", { placeId: place.id });
    });
};

// options.center: 검색 중심 {lat, lon} (없으면 현재 지도 중심)
// options.openPlaceId: 검색 후 이 장소의 정보창을 바로 연다 (다른 사람이 보고 있는 가게 따라 보기)
export const handleCategoryClick = async (category, map, markersRef, infoWindowRef, options = {}) => {
    if (!map) return;
    const { center: centerOverride, openPlaceId } = options;

    try {
        const center = map.getCenter();
        const lat = centerOverride?.lat ?? center.y;
        const lon = centerOverride?.lon ?? center.x;
        const searchCenter = { lat, lon };

        const travelId = parseInt(sessionStorage.getItem("selectedTravelId"), 10) || 0;
        if (!travelId) {
            alert("여행 ID가 없습니다.");
            return;
        }

        // 스크랩 목록 (공유 스토어). 스크랩을 못 불러와도 음식점/카페 검색은 계속한다.
        try {
            await loadScraps(travelId);
        } catch (err) {
            console.warn("스크랩 목록 불러오기 실패 (검색은 계속):", err);
        }
        const me = getCurrentUserId();

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
        activePins = [];

        const markerByPlaceId = {};
        places.forEach((place) => {
            const pos = new window.naver.maps.LatLng(place.lat, place.lon);
            const marker = new window.naver.maps.Marker({
                map,
                position: pos,
                icon: categoryPinIcon(category, scrapsAt(place.lat, place.lon)),
            });
            markersRef.current.push(marker);
            activePins.push({ marker, category, lat: place.lat, lon: place.lon });
            markerByPlaceId[place.id] = marker;

            marker.addListener("click", () =>
                openPlaceInfo({ map, marker, infoWindowRef, place, category, searchCenter, travelId, me })
            );
        });

        // 다른 사람이 보고 있던 가게를 따라 여는 경우
        if (openPlaceId != null && markerByPlaceId[openPlaceId]) {
            window.naver.maps.Event.trigger(markerByPlaceId[openPlaceId], "click");
        }
    } catch (err) {
        console.error("카테고리 요청 실패", err);
    }
};
