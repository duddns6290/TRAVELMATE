import axios from "axios";

const useTimeEdit = ({ schedule, setSchedule, selectedDay }) => {
    const handleSaveTime = async (index, timeStr) => {
        const arr = [...schedule[selectedDay]];
        const place = arr[index];
        if (!place || !place.id) return;

        const prevPlace = index > 0 ? arr[index - 1] : null;

        // 예외 처리: 이전 장소 시간이 존재할 경우 비교
        if (prevPlace?.time) {
            const currentTime = parseTime(timeStr);
            const prevTime = parseTime(prevPlace.time);

            if (currentTime <= prevTime) {
                alert(`방문 시간은 이전 장소보다 늦어야 합니다.\n이전 시간: ${prevPlace.time}`);
                return;
            }
        }

        try {
            await axios.put(`http://localhost:8080/place/${place.id}/visiting-time`, null, {
                params: { time: timeStr },
            });
            place.time = timeStr;
            setSchedule(prev => ({ ...prev, [selectedDay]: arr }));
            console.log("방문시간 저장 완료");
        } catch (err) {
            console.error("방문시간 저장 실패", err);
            alert("방문시간 저장 중 오류 발생");
        }
    };


    const handleTimeDelete = async (e, index) => {
        e?.stopPropagation();
        const arr = [...schedule[selectedDay]];
        const place = arr[index];
        if (!place || !place.id) return;

        const confirmed = window.confirm("시간을 삭제하시겠습니까?");
        if (!confirmed) return;

        try {
            await axios.delete(`http://localhost:8080/place/${place.id}/visiting-time`);
            arr[index].time = null;
            setSchedule(prev => ({ ...prev, [selectedDay]: arr }));
            console.log("방문시간 삭제 완료");
        } catch (err) {
            console.error("방문시간 삭제 실패", err);
            alert("방문시간 삭제 중 오류가 발생했습니다.");
        }
    };
    const parseTime = (timeStr) => {
        const [hour, minute] = timeStr.split(":").map(Number);
        return hour * 60 + minute;
    };

    return { handleSaveTime, handleTimeDelete };
};
export default useTimeEdit;