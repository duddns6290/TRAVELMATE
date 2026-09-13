import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import "./Tempdetail.css";

const Tempdetail = () => {
    const { id } = useParams();
    const [place, setPlace] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const mapRef = useRef(null);

    const [memos, setMemos] = useState([]); // ✅ 메모 상태 추가

    useEffect(() => {
        const fetchPlace = async () => {
            try {
                const res = await axios.get(`/tempplace/${id}`);
                setPlace(res.data);
            } catch (err) {
                console.error("상세 정보 불러오기 실패:", err);
                setError("장소 정보를 불러오지 못했습니다.");
            } finally {
                setLoading(false);
            }
        };
        fetchPlace();
    }, [id]);

    useEffect(() => {
        if (!id) return;
        axios.get(`/memos/temp/${id}`)
            .then(res => setMemos(res.data || []))
            .catch(err => {
                console.error("메모 불러오기 실패:", err);
                setMemos([]);
            });
    }, [id]);

    const handleDelete = () => {
        if (!window.confirm("정말 삭제하시겠습니까?")) return;

        axios.delete(`/tempplace/${id}`)
            .then(() => {
                alert("삭제되었습니다.");
                window.history.back();
            })
            .catch(err => {
                console.error("삭제 실패:", err);
                alert("삭제 중 오류가 발생했습니다.");
            });
    };

    useEffect(() => {
        if (place && window.naver && mapRef.current) {
            const location = new window.naver.maps.LatLng(place.latitude, place.longitude);

            const map = new window.naver.maps.Map(mapRef.current, {
                center: location,
                zoom: 15,
            });

            new window.naver.maps.Marker({
                position: location,
                map: map,
            });
        }
    }, [place]);

    const handleRegister = () => {
        window.registerToTimetable(
            place.latitude,
            place.longitude,
            place.name,
            place.address,
            place.restaurantId || null,
            place.image || ""
        );
    };

    if (loading) return <div className="place-detail">로딩 중...</div>;
    if (error) return <div className="place-detail">{error}</div>;
    if (!place) return <div className="place-detail">장소 정보 없음</div>;

    return (
        <div className="place-detail">
            <div className="header-row">
                <h2>{place.name}</h2>
                <div className="button-group">
                    <button className="register-button" onClick={handleRegister}>타임테이블에 등록하기</button>
                    <button className="delete-button" onClick={handleDelete}>삭제</button>
                </div>
            </div>

            <img src={place.image || "/defaultPlace.jpg"} alt={place.name} className="place-image" />
            <p><strong>주소:</strong> {place.address}</p>
            <p><strong>영업시간:</strong> {place.businessHour}</p>
            <p><strong>휴무일:</strong> {place.holiday}</p>

            <div id="small-map" ref={mapRef} style={{ width: "100%", height: "300px", marginTop: "20px", borderRadius: "8px" }}></div>

            {/* ✅ 등록된 메모 보여주기 */}
            {memos.length > 0 && (
                <div className="memo-section">
                    <h3 style={{ marginTop: "30px" }}>등록된 메모</h3>
                    <ul className="memo-list">
                        {memos.map((memo, i) => (
                            <li key={memo.memoId} className="memo-item">
                                <h4>{memo.memoTitle}</h4>
                                {memo.memoText && <p>{memo.memoText}</p>}
                                {memo.memoExtraLink && (
                                    <p>
                                        🔗 <a href={memo.memoExtraLink} target="_blank" rel="noopener noreferrer">{memo.memoExtraLink}</a>
                                    </p>
                                )}
                                {memo.memoImage && (
                                    <img
                                        src={memo.memoImage}
                                        alt="메모 이미지"
                                        style={{ maxWidth: "100%", borderRadius: "6px", marginTop: "8px" }}
                                    />
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default Tempdetail;
