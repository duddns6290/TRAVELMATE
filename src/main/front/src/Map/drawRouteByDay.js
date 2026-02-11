/* global naver */

export const drawRouteByDay = (map, places, selectedDay, markersRef, polylinesRef, color = '#368cb7') => {
    if (!map || !places || places.length === 0 || !selectedDay) return;

    const dayPlaces = places.filter(p => p.selected_day === selectedDay);
    if (dayPlaces.length === 0) return;

    // ✅ next_place_id 순서로 정렬
    const idToPlaceMap = {};
    const nextIdSet = new Set();
    dayPlaces.forEach(p => {
        idToPlaceMap[p.place_id] = p;
        if (p.next_place_id !== null) nextIdSet.add(p.next_place_id);
    });

    const start = dayPlaces.find(p => !nextIdSet.has(p.place_id));
    if (!start) return;

    const sorted = [];
    let current = start;
    while (current) {
        sorted.push(current);
        current = current.next_place_id ? idToPlaceMap[current.next_place_id] : null;
    }

    const path = sorted.map((p) => new naver.maps.LatLng(p.latitude, p.longitude));

    const polyline = new naver.maps.Polyline({
        map: map,
        path: path,
        strokeColor: color,
        strokeWeight: 4,
        strokeOpacity: 0.8,
        strokeStyle: 'solid',
    });
    polylinesRef.current.push(polyline);

    sorted.forEach((p, i) => {
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
            title: `${selectedDay}일차 - ${p.place_name}`,
        });
        markersRef.current.push(marker);
    });
};
