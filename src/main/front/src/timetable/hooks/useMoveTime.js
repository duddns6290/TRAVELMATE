import axios from "axios";

const useMoveTime = ({ schedule, setSchedule, selectedDay, setIsLoadingRoute, applyAndBroadcast }) => {
    const handleSelectTransport = async (type, index) => {
        const arr = [...schedule[selectedDay]];
        const from = arr[index];
        const to = arr[index + 1];

        if (!from || !to) return;

        try {
            setIsLoadingRoute(true);

            // 🚗 자동차 / 🚶 도보 / 🚌 대중교통 모두 백엔드에서 계산
            const mode = type.includes("자동차") ? "car" : type.includes("도보") ? "walk" : "transmit";
            const res = await axios.get("http://localhost:8080/api/route/v2", {
                params: {
                    fromName: from.name,
                    fromLat: from.latitude,
                    fromLon: from.longitude,
                    toName: to.name,
                    toLat: to.latitude,
                    toLon: to.longitude,
                    mode
                }
            });

            const estimatedTime = res.data.estimatedTime;
            const routeUrl = res.data.url;

            if (!estimatedTime || estimatedTime.includes("실패") || estimatedTime.includes("예외")) {
                console.error("이동시간 조회 실패:", estimatedTime);
                alert("🚨 이동시간을 가져오지 못했습니다. 잠시 후 다시 시도해주세요.");
                return;
            }

            const [timeStr, distanceStr] = estimatedTime.split("/");

            arr[index] = {
                ...from,
                type,
                travelTime: estimatedTime || "미정",
                placeUrl: routeUrl
            };

            const moveTimePayload = {
                type,
                time: timeStr?.trim(),
                distance: distanceStr?.trim(),
                departurePlace: Number(from.id),
                url: routeUrl
            };

            if (from.moveTimeId) {
                await axios.put(`http://localhost:8080/movetime/${from.moveTimeId}`, moveTimePayload, {
                    headers: { "Content-Type": "application/json" }
                });
            } else {
                const result = await axios.post("http://localhost:8080/movetime", moveTimePayload, {
                    headers: { "Content-Type": "application/json" }
                });
                const newMoveTimeId = result.data?.id;
                arr[index].moveTimeId = newMoveTimeId;
            }

            applyAndBroadcast("PLACE_MOVETIME_UPDATE", from.id, {
                selectedDay,
                type: arr[index].type,
                travelTime: arr[index].travelTime,
                moveTimeId: arr[index].moveTimeId,
                placeUrl: arr[index].placeUrl,
            });
        } catch (err) {
            console.error("이동시간 등록 실패:", err);
            alert("이동시간 등록 중 오류 발생");
        } finally {
            setIsLoadingRoute(false);
        }
    };

    const handleMoveTimeDelete = async (index) => {
        const arr = [...schedule[selectedDay]];
        const from = arr[index];

        if (!from || !from.moveTimeId) {
            alert("이동시간 정보가 없습니다.");
            return;
        }

        const confirmDelete = window.confirm("이 이동시간을 삭제하시겠습니까?");
        if (!confirmDelete) return;

        try {
            await axios.delete(`http://localhost:8080/movetime/${from.moveTimeId}`);

            // 상태 반영 + 다른 사용자에게 전파
            applyAndBroadcast("PLACE_MOVETIME_UPDATE", from.id, {
                selectedDay,
                type: null,
                travelTime: null,
                moveTimeId: null,
                placeUrl: null,
            });
            console.log("이동시간 삭제 완료");
        } catch (err) {
            console.error("이동시간 삭제 실패:", err);
            alert("이동시간 삭제 중 오류가 발생했습니다.");
        }
    };

    return {
        handleSelectTransport,
        handleMoveTimeDelete,
    };
};



export default useMoveTime;
