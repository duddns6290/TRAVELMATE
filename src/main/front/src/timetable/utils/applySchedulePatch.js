// 소켓으로 받은(또는 로컬에서 방금 만든) 편집 패치를 schedule 상태에 병합한다.
// actor 본인의 로컬 반영과 다른 사용자로부터 받은 원격 반영에 동일하게 사용된다.
export function applySchedulePatch(schedule, { type, placeId, newValue }) {
    if (!newValue || !newValue.selectedDay) return schedule;

    const day = newValue.selectedDay;
    const dayList = schedule[day];
    if (!dayList) return schedule;

    const targetId = String(placeId);

    switch (type) {
        case "PLACE_ADD": {
            if (dayList.some(item => item.id === newValue.item.id)) return schedule;
            return { ...schedule, [day]: [...dayList, newValue.item] };
        }

        case "PLACE_DELETE": {
            const filtered = dayList.filter(item => item.id !== targetId);
            if (!newValue.prevPlaceId) {
                return { ...schedule, [day]: filtered };
            }
            const prevId = String(newValue.prevPlaceId);
            return {
                ...schedule,
                [day]: filtered.map(item =>
                    item.id === prevId
                        ? { ...item, moveTimeId: null, travelTime: null, type: null, placeUrl: null }
                        : item
                ),
            };
        }

        case "PLACE_REORDER": {
            return { ...schedule, [day]: newValue.items };
        }

        // 서버가 확정한 순서(장소 id 목록). 순서가 바뀌면 그날 방문시간·이동시간은 서버에서 초기화되므로 화면도 비운다.
        // 내 목록과 장소 구성이 다르면(누가 막 추가/삭제) 합칠 수 없으므로 그대로 두고, 호출한 쪽이 다시 불러온다.
        case "ORDER_SYNC": {
            const order = (newValue.order || []).map(String);
            const byId = Object.fromEntries(dayList.map(item => [item.id, item]));
            if (order.length !== dayList.length || order.some(id => !byId[id])) return schedule;
            return {
                ...schedule,
                [day]: order.map((id, i) => ({
                    ...byId[id],
                    nextPlaceId: order[i + 1] ? Number(order[i + 1]) : null,
                    time: null, travelTime: null, moveTimeId: null, type: null, placeUrl: null,
                })),
            };
        }

        case "PLACE_TIME_UPDATE": {
            return {
                ...schedule,
                [day]: dayList.map(item =>
                    item.id === targetId ? { ...item, time: newValue.time } : item
                ),
            };
        }

        case "PLACE_MOVETIME_UPDATE": {
            return {
                ...schedule,
                [day]: dayList.map(item =>
                    item.id === targetId
                        ? {
                            ...item,
                            type: newValue.type,
                            travelTime: newValue.travelTime,
                            moveTimeId: newValue.moveTimeId,
                            placeUrl: newValue.placeUrl,
                        }
                        : item
                ),
            };
        }

        case "MEMO_UPDATE": {
            return {
                ...schedule,
                [day]: dayList.map(item =>
                    item.id === targetId ? { ...item, memos: newValue.memos } : item
                ),
            };
        }

        default:
            return schedule;
    }
}
