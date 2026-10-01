// 방문시간 선택용 30분 단위 슬롯과, 앞/뒤 장소 시간에 따른 선택 가능 범위를 계산한다.

export const SLOT_MINUTES = 30;

export const parseTime = (timeStr) => {
    const [hour, minute] = timeStr.split(":").map(Number);
    return hour * 60 + minute;
};

const formatTime = (minutes) =>
    `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

// 시간이 정해진 가장 가까운 이전/다음 장소 (중간의 "미정"은 건너뜀)
export const getTimeBounds = (dayItems = [], index) => ({
    prevPlace: dayItems.slice(0, index).reverse().find(p => p.time) || null,
    nextPlace: dayItems.slice(index + 1).find(p => p.time) || null,
});

// [{ value: "09:30", disabled: boolean }] 형태로 하루치 슬롯을 만든다.
// 현재 저장된 시간이 30분 단위가 아니면(예: 03:29) 그 값도 목록에 끼워 넣어 그대로 보이게 한다.
export const buildTimeSlots = (dayItems, index, currentTime) => {
    const { prevPlace, nextPlace } = getTimeBounds(dayItems, index);
    const min = prevPlace ? parseTime(prevPlace.time) : -1;
    const max = nextPlace ? parseTime(nextPlace.time) : 24 * 60;

    const values = [];
    for (let m = 0; m < 24 * 60; m += SLOT_MINUTES) values.push(formatTime(m));
    if (currentTime && !values.includes(currentTime)) {
        values.push(currentTime);
        values.sort((a, b) => parseTime(a) - parseTime(b));
    }

    return values.map(value => {
        const t = parseTime(value);
        return { value, disabled: t <= min || t >= max };
    });
};
