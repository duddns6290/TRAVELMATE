// 📁 src/hooks/useSchedule.js
import axios from "axios";
import { arrayMove } from "@dnd-kit/sortable";
import { applySchedulePatch } from "../utils/applySchedulePatch";
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

    try {
        // 서버가 한 트랜잭션에서 처리: 장소 삭제 + 앞뒤 다시 잇기 + 관련 이동시간 정리 (일차 잠금 안에서)
        await axios.delete(`http://localhost:8080/place/${place.id}`, { params: { userId } });

        // 저장 성공 후 화면 반영 + 다른 사용자에게 전파
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

export const useDragHandler = (schedule, setSchedule, selectedDay, userId) => {
    // 드래그로 순서 변경
    //  1. 화면은 바로 바꾼다 (낙관적 업데이트, 소켓 전파는 하지 않음)
    //  2. 서버에는 최종 순서가 아니라 "이 장소를 몇 번째로" 이동 명령만 보낸다
    //  3. 서버가 일차 잠금 + 트랜잭션으로 최신 순서에 적용하고, 확정된 순서를 모두에게 ORDER_SYNC로 보낸다
    //  4. 실패하면 이전 순서로 되돌리고(롤백) 서버 데이터로 다시 맞춘다
    const handleDragEnd = async (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const prevItems = schedule[selectedDay];
        const fromIndex = prevItems.findIndex(item => item.id === active.id);
        const toIndex = prevItems.findIndex(item => item.id === over.id);
        if (fromIndex === -1 || toIndex === -1) return;

        const travelId = prevItems[fromIndex].travelId;

        // 1. 낙관적 업데이트: 내 화면만 먼저 바꾼다. 순서가 바뀌면 방문시간·이동시간은 초기화된다(서버도 동일).
        const optimistic = arrayMove(prevItems, fromIndex, toIndex).map(item => ({
            ...item, time: null, travelTime: null, moveTimeId: null, type: null, placeUrl: null,
        }));
        setSchedule(prev => ({ ...prev, [selectedDay]: optimistic }));

        try {
            // 2. 이동 명령만 전송
            const res = await axios.post("http://localhost:8080/place/move", {
                travelId,
                day: selectedDay,
                placeId: parseInt(active.id, 10),
                toIndex,
                userId,
            });
            // 3. 서버가 확정한 순서로 맞춘다 (다른 사람 변경이 먼저 반영됐을 수 있음).
            //    같은 내용이 소켓 ORDER_SYNC로도 오지만, 응답으로 먼저 맞춰 두면 소켓이 늦어도 화면이 정확하다.
            const confirmed = (res.data.order || []).map(String);
            const mine = new Set(prevItems.map(item => item.id));
            const sameMembers = confirmed.length === mine.size && confirmed.every(id => mine.has(id));
            if (sameMembers) {
                setSchedule(prev => applySchedulePatch(prev, { type: "ORDER_SYNC", newValue: res.data }));
            } else {
                // 그사이 누가 장소를 추가·삭제해 내 목록과 다르면 서버에서 다시 불러온다
                window.dispatchEvent(new Event("refresh-timetable"));
            }
        } catch (err) {
            // 4. 롤백: 이전 순서로 되돌리고, 서버 데이터로 다시 불러와 확실히 맞춘다
            console.error("순서 변경 실패", err);
            setSchedule(prev => ({ ...prev, [selectedDay]: prevItems }));
            window.dispatchEvent(new Event("refresh-timetable"));
            alert(err.response?.status === 409
                ? "다른 사용자가 순서를 바꾸는 중이에요. 잠시 후 다시 시도해주세요."
                : "순서를 저장하지 못해 이전 순서로 되돌렸어요.");
        }
    };

    return { handleDragEnd };
};


