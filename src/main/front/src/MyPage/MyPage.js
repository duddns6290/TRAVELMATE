import React, {useEffect, useState, useContext} from "react";
import {UserContext} from "../UserContext";
import {useNavigate} from "react-router-dom";
import axios from "axios";
import "./Mypage.css";
import ShareSettings from "../Share/ShareSettings";
import {jwtDecode} from "jwt-decode";

const defaultImage = "https://capstone12345-bu.s3.ap-northeast-2.amazonaws.com/travel/1748192628867_%EC%97%AC%ED%96%89%20%EB%93%B1%EB%A1%9D%20%EA%B8%B0%EB%B3%B8%20%EC%9D%B4%EB%AF%B8%EC%A7%80.png";

const MyPage = () => {
    const navigate = useNavigate();
    const [trips, setTrips] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [activeMenuIndex, setActiveMenuIndex] = useState(null);
    const [form, setForm] = useState({title: "", start: "", end: "", image: null});
    const [showSharePopup, setShowSharePopup] = useState(false);
    const [selectedTravelId, setSelectedTravelId] = useState(null);
    const [friends, setFriends] = useState([]);
    const [friendInput, setFriendInput] = useState("");
    const [requesterId, setRequesterId] = useState("");
    const [requests, setRequests] = useState([]);
    const { userId, setUserId } = useContext(UserContext);
    const [editForm, setEditForm] = useState({ id: null, title: "", start: "", end: "", image: null });
    const [showEditModal, setShowEditModal] = useState(false);

    useEffect(() => {
        if (!userId) return;

        fetchTrips();
        fetchFriends();
        fetchRequests();
    }, [userId]);

    const fetchFriends = async () => {
        try {
            const res = await axios.get(`http://localhost:8080/user/${userId}/friends`);
            setFriends(res.data);
            console.log("친구 데이터:", res.data);
        } catch (err) {
            console.error("친구 목록 가져오기 실패:", err);
        }
    };


    const fetchRequests = async () => {
        try {
            const res = await axios.get(`http://localhost:8080/user/${userId}/friends/requested`);
            setRequests(res.data);
        } catch (err) {
            console.error("친구 요청 목록 가져오기 실패:", err);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("accessToken");
        navigate("/login");
    };

    const fetchTrips = async () => {
        try {
            const res = await axios.get(`http://localhost:8080/travel/${userId}`);
            const travelData = res.data.map(trip => ({
                travelId: trip.travel_id,
                title: trip.travel_name,
                date: `${trip.travel_start_date} ~ ${trip.travel_end_date}`,
                companions: `${trip.travel_period}일`,
                travel_period: trip.travel_period,
                image: trip.travel_image,
            }));
            setTrips(travelData);
        } catch (err) {
            console.error("여행 리스트 가져오기 실패:", err);
        }
    };
    //친구 요청
    const handleFriendRequest = async () => {
        try {
            await axios.post(`http://localhost:8080/user/${userId}/friends/request`, {
                friendId: friendInput
            });
            alert("친구 요청이 전송되었습니다.");
            setFriendInput("");
        } catch (err) {
            console.error("친구 요청 실패:", err);
            alert("요청 실패");
        }
    };

    //친구 승인
    const handleAcceptRequest = async (requesterId) => {
        try {
            const temp = await axios.post(`http://localhost:8080/user/${userId}/friends/accept`, {
                friendId: requesterId
            });
            console.log(temp)
            alert("친구 요청을 수락했습니다.");
            fetchFriends();  // 친구 목록 갱신
            fetchRequests(); // 요청 목록 갱신
        } catch (err) {
            console.error("친구 요청 수락 실패:", err);
            alert("수락 실패");
        }
    };

    useEffect(() => {
        const storedId = sessionStorage.getItem("userId");
        if (storedId) {
            setUserId(storedId);
        } else {
            alert("로그인이 만료되었습니다.");
            navigate("/login");
        }
    }, []);

    const handleUpdate = async () => {
        const updatedTravel = {
            travel_id: editForm.id,
            travel_name: editForm.title,
            travel_start_date: editForm.start,
            travel_end_date: editForm.end,
            travel_period: calculateDays(editForm.start, editForm.end),
            travel_image: editForm.image // 기존 이미지 경로 유지
        };

        try {
            await axios.put(`http://localhost:8080/travel/${editForm.id}`, updatedTravel, {
                headers: {
                    "Content-Type": "application/json"
                }
            });

            alert("여행이 수정되었습니다.");
            setShowEditModal(false);
            fetchTrips();
        } catch (err) {
            console.error("여행 수정 실패:", err);
            alert("수정 실패");
        }
    };

    const handleRegister = async () => {
        const travel = {
            travel_name: form.title,
            travel_start_date: form.start,
            travel_end_date: form.end
        };

        const users = [{
            userId: userId,
            role: "HOST"
        }];

        const formData = new FormData();
        formData.append("travel", new Blob([JSON.stringify(travel)], {type: "application/json"}));
        formData.append("users", new Blob([JSON.stringify(users)], {type: "application/json"}));

        if (form.image) {
            formData.append("image", form.image);
        }

        try {
            await axios.post("http://localhost:8080/travel", formData, {
                headers: {
                    "Content-Type": "multipart/form-data"
                }
            });
            await fetchTrips();
            setShowModal(false);
            setForm({title: "", start: "", end: "", image: null});
        } catch (err) {
            console.error("여행 등록 실패:", err);
        }
    };


    const handleEdit = (id) => {
        const trip = trips.find(t => t.travelId === id);
        if (trip) {
            setEditForm({
                id,
                title: trip.title,
                start: trip.date.split(" ~ ")[0],
                end: trip.date.split(" ~ ")[1],
                image: null
            });
            setShowEditModal(true);
        }
    };
    const handleDelete = async (id) => {
        if (window.confirm("정말 삭제하시겠습니까?")) {
            try {
                await axios.delete(`http://localhost:8080/travel/${id}`);
                fetchTrips();
            } catch (err) {
                console.error("삭제 실패:", err);
            }
        }
    };

    const handlepdf = async (travelId, travelTitle) => {
        try {
            const response = await axios.get(`http://localhost:8080/pdf/travel/${travelId}/timetable`, {
                responseType: 'blob',
            });

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${travelTitle}_일정표.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('PDF 다운로드 실패:', error);
            alert('PDF 다운로드 중 오류가 발생했습니다.');
        }
    };



    const handleShare = (id) => {
        setSelectedTravelId(id);
        setShowSharePopup(true);
    };
    const calculateDays = (start, end) => {
        const s = new Date(start);
        const e = new Date(end);
        return Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1;
    };

    return (
        <div className="wrapper">
            <div className="topBar">
                <div className="logo" onClick={() => navigate("/")}>TravelMate</div>
                <button className="logoutButton" onClick={handleLogout}>로그아웃</button>
            </div>

            <div className="page">
                <div className="userGreeting">☁️{userId}님의 여행☁️</div>
                <div style={{display: "flex", height: "100%"}}>
                    <div className="travelBox">
                        <div className="travelFriend">여행 친구</div>
                        <div className="leftPanel">
                            <div>
                                {friends.map((friend, index) => (
                                    <div key={index} className="friendCard">
                                        <div>
                                            <div><strong>{friend.name}</strong></div>
                                            <div style={{fontSize: "0.85rem", color: "#555"}}>{friend.email}</div>
                                            <div style={{fontSize: "0.8rem", color: "#999"}}>ID: {friend.userid}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="friendRequestSection">
                                <h4>친구 추가</h4>
                                <input
                                    type="text"
                                    value={friendInput}
                                    onChange={(e) => setFriendInput(e.target.value)}
                                    placeholder="친구 ID 입력"
                                    className="input"
                                />
                                <button onClick={handleFriendRequest} className="submitButton">요청 보내기</button>
                            </div>

                            <div className="requestList">
                                <h4>요청 수락</h4>
                                {requests.length === 0 ? (
                                    <div>받은 요청이 없습니다.</div>
                                ) : (
                                    requests.map((req, index) => (
                                        <div key={index} className="friendCard">
                                            <div className="friendCardLeft">
                                                <div><strong>{req.name}</strong></div>
                                                <div style={{fontSize: "0.85rem", color: "#555"}}>{req.email}</div>
                                                <div style={{fontSize: "0.8rem", color: "#999"}}>ID: {req.userid}</div>
                                            </div>
                                            <button className="submitButton"
                                                    onClick={() => handleAcceptRequest(req.userid)}>수락하기
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>

                        </div>
                    </div>
                    <div className="rightPanel">
                        <div className="header">
                            <h2 className="title">내 여행 {trips.length}</h2>
                            <button className="addButton" onClick={() => setShowModal(true)}>여행 등록</button>
                        </div>

                        <div className="tripList">
                            {trips.map((trip, index) => (
                                <div key={index} className="card">
                                    <img src={trip.image || defaultImage} alt="trip" className="image"/>
                                    <div className="cardText">
                                        <strong className="tripTitle" onClick={async () => {
                                            try {
                                                const userId = sessionStorage.getItem("userId"); // 세션에서 사용자 ID 가져오기

                                                const response = await axios.post("http://localhost:8080/auth/switch-travel",
                                                    {
                                                        userId: userId,
                                                        travelId: trip.travelId
                                                    },
                                                    {
                                                        headers: {
                                                            "Content-Type": "application/json"
                                                        }
                                                    }
                                                );

                                                const newToken = response.data.token;
                                                localStorage.setItem("accessToken", newToken); // 여행 전용 토큰 저장
                                                const token = localStorage.getItem("accessToken");
                                                console.log("토큰 저장완료");
                                                const decoded = jwtDecode(token);
                                                console.log(decoded);
                                                navigate(`/timetable/${trip.travelId}/${trip.travel_period}`, {
                                                    state: {period: trip.travel_period, title: trip.title}
                                                })
                                            } catch (error) {
                                                console.error("여행 토큰 전환 실패:", error);
                                            }
                                        }}>
                                            {trip.title}
                                        </strong>

                                        <div className="detail">{trip.date} ({trip.companions})</div>
                                    </div>
                                    <div
                                        className="menuButton"
                                        onClick={() => setActiveMenuIndex(activeMenuIndex === index ? null : index)}>
                                        ⋯
                                        {activeMenuIndex === index && (
                                            <div className="dropdownMenu">
                                                <div className="menuItem" onClick={() => handleShare(trip.travelId)}>공유
                                                    설정
                                                </div>
                                                <div className="menuItem" onClick={() => handleEdit(trip.travelId)}>여행
                                                    수정
                                                </div>
                                                <div className="menuItem" onClick={() => handleDelete(trip.travelId)}>여행
                                                    삭제
                                                </div>
                                                <div className="menuItem"
                                                     onClick={() => handlepdf(trip.travelId, trip.title)}>pdf 다운
                                                </div>

                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </div>
            {showEditModal && (
                <div className="modalOverlay">
                    <div className="modal">
                        <h3>여행 수정</h3>
                        <input
                            type="text"
                            placeholder="여행명"
                            value={editForm.title}
                            onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                            className="input"
                        />
                        <input
                            type="date"
                            value={editForm.start}
                            onChange={(e) => setEditForm({...editForm, start: e.target.value})}
                            className="input"
                        />
                        <input
                            type="date"
                            value={editForm.end}
                            onChange={(e) => setEditForm({...editForm, end: e.target.value})}
                            className="input"
                        />

                        <button className="submitButton" onClick={handleUpdate}>수정</button>
                        <button className="cancelButton" onClick={() => setShowEditModal(false)}>취소</button>
                    </div>
                </div>
            )}

            {showModal && (
                <div className="modalOverlay">
                    <div className="modal">
                        <h3>여행 등록</h3>
                        <input type="text" placeholder="여행명" value={form.title}
                               onChange={(e) => setForm({...form, title: e.target.value})} className="input"/>
                        <input type="date" value={form.start}
                               onChange={(e) => setForm({...form, start: e.target.value})} className="input"/>
                        <input type="date" value={form.end}
                               onChange={(e) => setForm({...form, end: e.target.value})} className="input"/>
                        <input type="file" accept="image/*"
                               onChange={(e) => setForm({...form, image: e.target.files[0]})} className="input"/>
                        <button className="submitButton" onClick={handleRegister}>등록</button>
                        <button className="cancelButton" onClick={() => setShowModal(false)}>취소</button>
                    </div>
                </div>
            )}

            {showSharePopup && (
                <ShareSettings
                    travelId={selectedTravelId}
                    onClose={() => setShowSharePopup(false)}
                />
            )}
        </div>
    );
};


export default MyPage;
