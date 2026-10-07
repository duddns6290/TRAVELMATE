/* global naver */

// 타임테이블 패널과 같은 schedule 상태(이미 순서대로 정렬된 하루치 장소 배열)로 경로와 번호 마커를 그린다.
// 지도가 DB를 따로 조회하면 패널과 순서/시점이 어긋나므로 반드시 schedule을 그대로 받는다.
export const drawRouteByDay = (map, dayItems, selectedDay, markersRef, polylinesRef, color = '#368cb7') => {
    if (!map || !dayItems || dayItems.length === 0) return;

    const valid = dayItems.filter(p => p.latitude != null && p.longitude != null);
    if (valid.length === 0) return;

    const polyline = new naver.maps.Polyline({
        map: map,
        path: valid.map((p) => new naver.maps.LatLng(p.latitude, p.longitude)),
        strokeColor: color,
        strokeWeight: 4,
        strokeOpacity: 0.8,
        strokeStyle: 'solid',
    });
    polylinesRef.current.push(polyline);

    valid.forEach((p, i) => {
        const markerContent = `
            <div style="
                background-color: #4A90E2;
                color: white;
                border-radius: 50%;
                width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                font-weight: bold;
                border: 2px solid white;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            ">
                ${i + 1}
            </div>
        `;

        const marker = new naver.maps.Marker({
            map: map,
            position: new naver.maps.LatLng(p.latitude, p.longitude),
            icon: {
                content: markerContent,
                anchor: new naver.maps.Point(14, 14),
            },
            title: `${selectedDay}일차 - ${p.name}`,
        });
        markersRef.current.push(marker);
    });
};
