/* global naver */
export const handleAddPlace = async (newPlace, setNewPlace, setModal) => {
    if (!newPlace.name || !newPlace.address) {
        alert("장소 이름과 주소를 모두 입력해주세요.");
        return;
    }

    try {
        const { lat, lng } = await getCoordinatesFromAddress(newPlace.address);
        console.log("좌표 반환", lat,lng, newPlace.address)
        if (window.registerToTimetable) {
            window.registerToTimetable(lat, lng, newPlace.name, newPlace.address);
        }

        setNewPlace({ name: "", address: "", category: "음식점" });
        setModal(null);
    } catch (error) {
        console.error("좌표 변환 실패:", error);
        alert("주소를 좌표로 변환하는 데 실패했습니다.");
    }
};

export const getCoordinatesFromAddress = (address) => {
    return new Promise((resolve, reject) => {
        console.log("쿠디네이트 함수 실행")
        naver.maps.Service.geocode({ query: address }, function (status, response) {
            if (status !== naver.maps.Service.Status.OK) {
                reject("주소 검색 실패");
                return;
            }
            const result = response.v2.addresses[0];
            const lat = parseFloat(result.y);
            const lng = parseFloat(result.x);
            resolve({ lat, lng });
        });
    });
};
