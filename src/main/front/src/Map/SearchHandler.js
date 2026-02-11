import axios from "axios";

export const handleSearchInputChange = async (e, setSearchText, setAutocompleteList) => {
    const val = e.target.value;
    setSearchText(val);

    const isLikelyAddress = /(\d+|로|길|구|동|읍|면|리|시|도)/.test(val);
    if (val.length > 1 && !isLikelyAddress) {
        try {
            const res = await axios.get("/restaurant/autosearch", {
                params: { keyword: val, limit: 10 }
            });
            setAutocompleteList(res.data);
        } catch (err) {
            console.error("자동완성 실패", err);
        }
    } else {
        setAutocompleteList([]);
    }
};

export const handleSearchKeyDown = (e, autocompleteList, setSearchText, setAutocompleteList, map, markersRef) => {
    if (e.key === "Enter") {
        if (autocompleteList.length > 0) {
            const selected = autocompleteList[0];
            setSearchText(selected.title);
            setAutocompleteList([]);
        }
    }
};


export const searchAddressToCoordinate = (text, map, markerRef, retry = true) => {
    if (!window.naver || !map || !text) return;

    window.naver.maps.Service.geocode({ query: text }, async (status, res) => {
        if (status === window.naver.maps.Service.Status.OK && res.v2.addresses.length > 0) {
            const r = res.v2.addresses[0];
            const point = new window.naver.maps.LatLng(r.y, r.x);
            map.setCenter(point);

            if (markerRef.current) markerRef.current.setMap(null);
            markerRef.current = new window.naver.maps.Marker({ map, position: point });

        } else if (retry) {
            console.warn("Geocode 실패, 카카오 키워드 검색 재시도...");
            try {
                const { name, address, lat, lng } = await getCoordinatesFromKeyword(text);
                const point = new window.naver.maps.LatLng(lat, lng);
                map.setCenter(point);

                if (markerRef.current) markerRef.current.setMap(null);

                const marker = new window.naver.maps.Marker({ map, position: point });
                markerRef.current = marker;

                // 🔲 InfoWindow용 DOM 엘리먼트 생성
                const container = document.createElement("div");
                container.style.padding = "8px";
                container.style.fontSize = "14px";
                container.innerHTML = `
                    <strong>${name}</strong><br/>
                    ${address}<br/>
                    <button id="registerBtn" style="margin-top:6px; background:#368cb7; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">
                        타임테이블에 등록하기
                    </button>
                `;

                const infoWindow = new window.naver.maps.InfoWindow({
                    content: container,
                    anchorSkew: true
                });

                infoWindow.open(map, marker);

                container.querySelector("#registerBtn").addEventListener("click", () => {
                    if (typeof window.registerToTimetable === "function") {
                        window.registerToTimetable(lat, lng, name, address, null, null);
                        infoWindow.close();
                    } else {
                        alert("registerToTimetable 함수가 정의되지 않았습니다.");
                    }
                });

            } catch (err) {
                alert(err.message || "카카오 키워드 검색 실패");
            }
        } else {
            alert("주소 검색 실패");
        }
    });
};

export const getCoordinatesFromKeyword = (keyword) => {
    return new Promise((resolve, reject) => {
        if (!window.kakao || !window.kakao.maps || !window.kakao.maps.services) {
            reject("카카오 지도 API 로딩 실패");
            return;
        }

        const ps = new window.kakao.maps.services.Places();
        ps.keywordSearch(keyword, (data, status) => {
            if (status !== window.kakao.maps.services.Status.OK || !data.length) {
                reject(new Error("장소 검색 실패"));
                return;
            }

            const place = data[0];
            resolve({
                name: place.place_name,
                address: place.road_address_name || place.address_name,
                lat: parseFloat(place.y),
                lng: parseFloat(place.x) });
        });
    });
};
