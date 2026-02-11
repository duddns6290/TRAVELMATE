import axios from "axios";

const useMoveTime = ({ schedule, setSchedule, selectedDay, setIsLoadingRoute }) => {
    const handleSelectTransport = async (type, index) => {
        const arr = [...schedule[selectedDay]];
        const from = arr[index];
        const to = arr[index + 1];

        if (!from || !to) return;

        try {
            setIsLoadingRoute(true);

            let estimatedTime = "";
            let routeUrl = "";

            // ✅ 자동차인 경우 Tmap API 호출
            if (type.includes("자동차")) {
                console.log("tmap")
                const res = await fetch("https://apis.openapi.sk.com/tmap/routes?version=1&format=json", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "appKey": "oRcR9euVixaMbNI65AKxx3VaEI9DUICP6wwe08Zo"
                    },
                    body: JSON.stringify({
                        startX: from.longitude.toString(),
                        startY: from.latitude.toString(),
                        endX: to.longitude.toString(),
                        endY: to.latitude.toString(),
                        reqCoordType: "WGS84GEO",
                        resCoordType: "WGS84GEO",
                        startName: from.name,
                        endName: to.name
                    })
                });

                const data = await res.json();
                const duration = data.features?.[0]?.properties?.totalTime;
                const distance = data.features?.[0]?.properties?.totalDistance;

                if (!duration) throw new Error("Tmap 응답 없음");

                estimatedTime = `${Math.ceil(duration / 60)}분 / ${(distance / 1000).toFixed(1)}km`;

                const urlRes = await axios.get("http://localhost:8080/api/route/v2", {
                    params: {
                        fromName: from.name,
                        fromLat: from.latitude,
                        fromLon: from.longitude,
                        toName: to.name,
                        toLat: to.latitude,
                        toLon: to.longitude,
                        mode: "car"
                    }
                });
                routeUrl = urlRes.data.url;
            } else {
                // 🚶 도보/대중교통은 기존 API 사용
                const res = await axios.get("http://localhost:8080/api/route/v2", {
                    params: {
                        fromName: from.name,
                        fromLat: from.latitude,
                        fromLon: from.longitude,
                        toName: to.name,
                        toLat: to.latitude,
                        toLon: to.longitude,
                        mode: type.includes("도보") ? "walk" : "transmit"
                    }
                });

                if (res.data.estimatedTime.includes("크롤링 실패") || res.data.estimatedTime.includes("예외") ) {
                    alert("🚨 크롤링에 실패했습니다. 다시 시도해주세요.");
                    return;
                }

                estimatedTime = res.data.estimatedTime;
                routeUrl = res.data.url;
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

            setSchedule(prev => ({ ...prev, [selectedDay]: arr }));
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

            // 프론트 상태 업데이트
            arr[index] = {
                ...from,
                travelTime: null,
                moveTimeId: null,
                type: null,
                placeUrl: null
            };

            setSchedule(prev => ({ ...prev, [selectedDay]: arr }));
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
