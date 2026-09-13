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
