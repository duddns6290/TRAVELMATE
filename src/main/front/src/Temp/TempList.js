import React, { useEffect, useState } from "react";
import axios from "axios";
import "./TempList.css";
import { useNavigate } from "react-router-dom";

const TempList = () => {
    const [places, setPlaces] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const navigate = useNavigate();
    const travelId = sessionStorage.getItem("selectedTravelId");

    // ✅ 메모 모달 상태
    const [showMemoModal, setShowMemoModal] = useState(false);
    const [memoText, setMemoText] = useState("");
    const [memoTitle, setMemoTitle] = useState("");
    const [memoImage, setMemoImage] = useState("");
    const [memoExtraLink, setMemoExtraLink] = useState("");
    const [selectedTempId, setSelectedTempId] = useState(null);

    useEffect(() => {
        if (travelId) {
            axios.get(`/tempplace/travel/${travelId}`)
                .then(res => setPlaces(res.data))
                .catch(err => {
                    console.error("임시 장소 불러오기 실패:", err);
                    alert("장소 정보를 불러오지 못했습니다.");
                });
        }
    }, [travelId]);

    const cardsPerPage = 3;
    const visiblePlaces = places.slice(currentIndex, currentIndex + cardsPerPage);

    const handleAddMemo = async () => {
        if (!memoText || !memoTitle || !selectedTempId) {
            alert("메모 제목과 내용을 입력해주세요.");
            return;
        }

        const payload = {
            memoText,
            memoTitle,
            memoImage,
            memoExtraLink,
            tempId: Number(selectedTempId), // 반드시 숫자로
        };

        try {
            const res = await axios.post(`/memos/temp/${selectedTempId}/memo`, payload, {
                headers: {
                    "Content-Type": "application/json;charset=UTF-8"
                }
            });

            console.log("✅ 메모 등록 성공:", res.data);
            alert("메모가 저장되었습니다.");

            // 초기화
            setShowMemoModal(false);
            setMemoText("");
            setMemoTitle("");
            setMemoImage("");
            setMemoExtraLink("");
            setSelectedTempId(null);
        } catch (err) {
            console.error("❌ 메모 등록 실패:", err.response?.data || err.message);
            alert("메모 저장 중 오류가 발생했습니다.");
        }
    };

    return (
        <div className="temp-modal-overlay">
            <div className="temp-modal-content">
                <h2 style={{ textAlign: "center" }}>등록한 임시 장소</h2>

                {places.length === 0 ? (
                    <p style={{ textAlign: "center" }}>등록된 장소가 없습니다.</p>
                ) : (
                    <div className="place-nav">
                        <button
                            onClick={() => setCurrentIndex(prev => Math.max(prev - cardsPerPage, 0))}
                            disabled={currentIndex === 0}
                        >
                            &lt;
                        </button>

                        <div className="place-cards">
                            {visiblePlaces.map((place, i) => (
                                <div
                                    key={i}
                                    className="place-card"
                                    onClick={() => {
                                        if (!place.id) {
                                            alert("상세 정보를 불러올 수 없는 장소입니다.");
                                            return;
                                        }
                                        navigate(`/tempplace/${place.id}`);
                                    }}
                                >
                                    <p><strong>{place.name}</strong></p>
                                    <p>{place.address}</p>
                                    {place.image && <img src={place.image} alt={place.name}/>}

                                    {/* ✅ 메모 추가 버튼 */}
                                    <button
                                        className="tmpmemo-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedTempId(place.id);
                                            setShowMemoModal(true);
                                        }}
                                    >
                                        메모 등록
                                    </button>


                                </div>
                                ))}
                        </div>

                        <button
                            onClick={() =>
                                setCurrentIndex(prev =>
                                    Math.min(prev + cardsPerPage, places.length - cardsPerPage)
                                )
                            }
                            disabled={currentIndex + cardsPerPage >= places.length}
                        >
                            &gt;
                        </button>
                    </div>
                )}

                <button className="close-btn" onClick={() => navigate(-1)}>닫기</button>

                {/* ✅ 메모 입력 모달 */}
                {showMemoModal && (
                    <div className="memo-modal">
                        <div className="memo-modal-content">
                            <h3>메모 입력</h3>
                            <input
                                type="text"
                                placeholder="메모 제목"
                                value={memoTitle}
                                onChange={e => setMemoTitle(e.target.value)}
                            />
                            <textarea
                                rows={3}
                                placeholder="메모 텍스트"
                                value={memoText}
                                onChange={e => setMemoText(e.target.value)}
                            />
                            <input
                                type="text"
                                placeholder="추가 링크 (선택)"
                                value={memoExtraLink}
                                onChange={e => setMemoExtraLink(e.target.value)}
                            />
                            <input
                                type="text"
                                placeholder="이미지 URL (선택)"
                                value={memoImage}
                                onChange={e => setMemoImage(e.target.value)}
                            />
                            <div style={{ marginTop: "10px" }}>
                                <button onClick={handleAddMemo}>저장</button>
                                <button onClick={() => setShowMemoModal(false)} style={{ marginLeft: "10px" }}>취소</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TempList;
