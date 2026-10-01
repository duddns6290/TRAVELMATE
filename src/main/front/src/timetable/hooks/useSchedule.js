// 📁 src/hooks/useSchedule.js
import axios from "axios";
import { arrayMove } from "@dnd-kit/sortable";
import { sortPlacesByNextPlaceId } from "../utils/sortPlaces";

export const fetchSchedule = async (travelId, period, setSchedule) => {
    if (!travelId || !period) return;

    try {
        const res = await axios.get(`http://localhost:8080/place/travel/${travelId}`);
        const placeList = res.data;
        console.log("여행 목록", placeList)
        // 1. 메모 비동기 요청
        const memoPromises = placeList.map(place =>
            axios
                .get(`http://localhost:8080/memos/place/${place.place_id}`)
                .then(res => ({ placeId: place.place_id, memos: res.data }))
                .catch(() => ({ placeId: place.place_id, memos: [] }))
        );
        const memoResults = await Promise.all(memoPromises);

        const memoMap = {};
        memoResults.forEach(({ placeId, memos }) => {
            memoMap[placeId] = (memos || []).map((memo, index) => {
                const contents = [];
                if (memo.memoText) contents.push({ type: "text", content: memo.memoText });
                if (memo.memoExtraLink) contents.push({ type: "link", content: memo.memoExtraLink });
                if (memo.memoImage) contents.push({ type: "image", content: memo.memoImage });
                return { memoId: memo.memoId, title: memo.memoTitle || `메모 ${index + 1}`, contents, userId: memo.userId || null };
            });
        });

        // 2. 이동 시간 조회 — 모든 장소를 병렬로 조회한다.
        // (예전에는 DB 순서상 "다음 항목"이 같은 날일 때만 조회해서, 타임라인 순서와 DB 순서가 다르면 저장된 이동시간이 안 보였다)
        await Promise.all(placeList.map(async (from) => {
            try {
                const moveRes = await axios.get(`http://localhost:8080/movetime/departure/${from.place_id}`);
                const moveTimeData = moveRes.data?.[0];
                if (moveTimeData) {
                    from.travelTime = `${moveTimeData.time} / ${moveTimeData.distance}`;
                    from.type = moveTimeData.type;
                    from.moveTimeId = moveTimeData.id;
                    from.placeUrl = moveTimeData.url;
                }
            } catch (err) {
                console.warn(`이동시간 조회 실패 (place_id: ${from.place_id})`, err);
            }
        }));

        // 3. 초기 스케줄 세팅
        const scheduleMap = {};
        for (let i = 1; i <= period; i++) {
            scheduleMap[i] = [];
        }

        placeList.forEach(place => {
            const day = parseInt(place.selected_day);
            if (!day || !scheduleMap[day]) return;

            const item = {
                id: place.place_id.toString(),
                name: place.place_name,
                address: place.place_address,
                image: place.place_image,
                businessHour: place.place_business_hour,
                holiday: place.place_holiday,
                stayTime: place.stay_time,
                nextPlaceId: place.next_place_id,
                time: place.place_visiting_time === "00:00:00" ? null : place.place_visiting_time?.slice(0, 5),
                latitude: place.latitude,
                longitude: place.longitude,
                travelId: place.travelId,
                selectedDay: place.selected_day,
                mongo: place.mongo,
                travelTime: place.travelTime || null,
                type: place.type || null,
                moveTimeId: place.moveTimeId || null,
                placeUrl: place.placeUrl || null,
                memos: memoMap[place.place_id] || [],
                showMemoPanel: false
            };

            scheduleMap[day].push(item);
        });

        // 4. 순서 정렬
        Object.keys(scheduleMap).forEach(day => {
            scheduleMap[day] = sortPlacesByNextPlaceId(scheduleMap[day]);
        });

        setSchedule(scheduleMap);
    } catch (err) {
        console.error("전체 일정 불러오기 실패:", err);
    }
};

export const handleItemClick = async (index, activeMode, schedule, selectedDay, setSchedule, applyAndBroadcast, userId) => {
    if (activeMode !== "delete") return;

    const arr = [...schedule[selectedDay]];
    const place = arr[index];
    if (!place || !place.id) return;

    const confirmed = window.confirm("이 장소를 삭제하시겠습니까?");
    if (!confirmed) return;

    const prevPlace = index > 0 ? arr[index - 1] : null;
    const nextPlace = arr[index + 1] || null;

    try {
        // 1. 앞 이동시간 삭제
        if (prevPlace?.moveTimeId) {
            await axios.delete(`http://localhost:8080/movetime/${prevPlace.moveTimeId}`);
            prevPlace.moveTimeId = null;
            prevPlace.travelTime = null;
            prevPlace.type = null;
            prevPlace.placeUrl = null;
            console.log("앞 이동시간 삭제 완료");
        }

        // 2. 뒤 이동시간 삭제
        if (place.moveTimeId) {
            await axios.delete(`http://localhost:8080/movetime/${place.moveTimeId}`);
            console.log("뒤 이동시간 삭제 완료");
        }

        // 3. 앞 장소의 next_place_id 갱신
        if (prevPlace) {
            const payload = {
                place_id: parseInt(prevPlace.id),
                place_name: prevPlace.name,
                place_address: prevPlace.address,
                place_image: prevPlace.image,
                place_business_hour: prevPlace.businessHour,
                place_holiday: prevPlace.holiday,
                place_stay_time: prevPlace.stayTime,
                next_place_id: nextPlace ? parseInt(nextPlace.id) : null,
                place_visiting_time: prevPlace.time && prevPlace.time !== "미정" ? `${prevPlace.time}:00` : "00:00:00",
                latitude: prevPlace.latitude,
                longitude: prevPlace.longitude,
                travelId: prevPlace.travelId,
                selected_day: prevPlace.selectedDay,
                mongo: prevPlace.mongo
            };

            await axios.put(`http://localhost:8080/place/${prevPlace.id}`, payload);
            console.log("next_place_id 갱신 완료");
        }

        // 4. 장소 삭제
        await axios.delete(`http://localhost:8080/place/${place.id}`, { params: { userId } });
        console.log("장소 삭제 완료");

        // 5. 상태 반영 + 다른 사용자에게 전파
        applyAndBroadcast("PLACE_DELETE", place.id, { selectedDay, prevPlaceId: prevPlace?.id });
        window.dispatchEvent(new Event("refresh-timetable"));
    } catch (err) {
        if (err.response?.status === 409) {
            alert("다른 사용자가 편집 중인 장소입니다.");
            return;
        }
        console.error("장소 삭제 처리 중 오류:", err);
        alert("삭제 중 오류가 발생했습니다.");
    }
};

export const useDragHandler = (schedule, setSchedule, selectedDay, applyAndBroadcast) => {
    // 원래 목록(prevItems)의 이동시간/방문시간을 지우고, 새 순서(items)대로 next_place_id를 저장한다.
    // 장소별 요청은 서로 독립적이므로 병렬로 보낸다.
    const persistOrder = async (prevItems, items) => {
        await Promise.all(prevItems.map(async (place) => {
            if (!place.moveTimeId) return;
            try {
                await axios.delete(`http://localhost:8080/movetime/${place.moveTimeId}`);
            } catch (err) {
                console.error("이동시간 삭제 실패", err);
            }
        }));

        await Promise.all(items.map(async (current, i) => {
            const next = items[i + 1];
            const payload = {
                place_id: parseInt(current.id),
                place_name: current.name,
                place_address: current.address,
                place_image: current.image,
                place_business_hour: current.businessHour,
                place_holiday: current.holiday,
                place_stay_time: current.stayTime,
                next_place_id: next ? parseInt(next.id) : null,
                place_visiting_time: "00:00:00", // 순서가 바뀌면 방문시간은 초기화
                latitude: current.latitude,
                longitude: current.longitude,
                travelId: current.travelId,
                selected_day: current.selectedDay,
                mongo: current.mongo
            };

            try {
                await axios.put(`http://localhost:8080/place/${current.id}`, payload);
            } catch (err) {
                console.error("순서 업데이트 실패", err);
            }
        }));
    };

    const handleDragEnd = async (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const prevItems = schedule[selectedDay];
        const fromIndex = prevItems.findIndex(item => item.id === active.id);
        const toIndex = prevItems.findIndex(item => item.id === over.id);
        if (fromIndex === -1 || toIndex === -1) return;

        // 화면에 보이는 순서와 저장되는 순서가 같도록 한 번만 계산한다.
        // 순서가 바뀌면 방문시간/이동시간은 의미가 없어지므로 즉시 비워서 저장 후 화면이 튀지 않게 한다.
        const items = arrayMove(prevItems, fromIndex, toIndex).map((item, i, arr) => ({
            ...item,
            nextPlaceId: arr[i + 1] ? parseInt(arr[i + 1].id) : null,
            time: null,
            travelTime: null,
            moveTimeId: null,
            type: null,
            placeUrl: null,
        }));

        // 1. 즉시 화면(패널+지도) 반영 + 다른 사용자에게 전파
        applyAndBroadcast("PLACE_REORDER", null, { selectedDay, items });

        // 2. 서버 저장
        await persistOrder(prevItems, items);
    };

    return { handleDragEnd };
};


