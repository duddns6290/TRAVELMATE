import axios from "axios";
import { getTimeBounds, parseTime } from "../utils/timeSlots";

const useTimeEdit = ({ schedule, setSchedule, selectedDay, applyAndBroadcast, userId }) => {
    // 저장에 성공하면 true, 검증 실패/오류면 false를 돌려준다. (false면 모달을 닫지 않음)
    const handleSaveTime = async (index, timeStr) => {
        const arr = [...schedule[selectedDay]];
        const place = arr[index];
        if (!place || !place.id) return false;

        if (!timeStr) {
            alert("방문 시간을 선택해주세요.");
            return false;
        }

        // 시간이 정해진 가장 가까운 이전/다음 장소와 비교한다. (중간에 "미정"이 있어도 건너뛰고 비교)
        const { prevPlace, nextPlace } = getTimeBounds(arr, index);
        const currentTime = parseTime(timeStr);

        if (prevPlace && currentTime <= parseTime(prevPlace.time)) {
            alert(`전 가게(${prevPlace.name}, ${prevPlace.time})보다 이후 시간만 선택할 수 있습니다.`);
            return false;
        }
        if (nextPlace && currentTime >= parseTime(nextPlace.time)) {
            alert(`다음 가게(${nextPlace.name}, ${nextPlace.time})보다 이전 시간만 선택할 수 있습니다.`);
            return false;
        }

        try {
            await axios.put(`http://localhost:8080/place/${place.id}/visiting-time`, null, {
                params: { time: timeStr, userId },
            });
            applyAndBroadcast("PLACE_TIME_UPDATE", place.id, { selectedDay, time: timeStr });
            console.log("방문시간 저장 완료");
            return true;
        } catch (err) {
            if (err.response?.status === 409) {
                alert("다른 사용자가 편집 중인 장소입니다.");
                return false;
            }
            console.error("방문시간 저장 실패", err);
            alert("방문시간 저장 중 오류 발생");
            return false;
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
            applyAndBroadcast("PLACE_TIME_UPDATE", place.id, { selectedDay, time: null });
            console.log("방문시간 삭제 완료");
        } catch (err) {
            console.error("방문시간 삭제 실패", err);
            alert("방문시간 삭제 중 오류가 발생했습니다.");
        }
    };
    return { handleSaveTime, handleTimeDelete };
};
export default useTimeEdit;