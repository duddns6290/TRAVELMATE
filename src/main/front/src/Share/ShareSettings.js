import React, { useEffect, useState } from "react";
import axios from "axios";
import "./ShareSettings.css";

const ShareSettings = ({ travelId, onClose }) => {
    const [users, setUsers] = useState([]);
    const [emailInput, setEmailInput] = useState("");
    const [newUserInfo, setNewUserInfo] = useState(null);
    const [editedRoles, setEditedRoles] = useState({});
    const [loadError, setLoadError] = useState(false);

    const loggedInUserId = sessionStorage.getItem("userId");

    const roleToLabel = {
        GUEST_READ: "게스트(읽기)",
        GUEST_WRITE: "게스트(쓰기)",
        HOST: "호스트",
    };

    const isHost = users.find(u => u.userId === loggedInUserId)?.role === "HOST";

    useEffect(() => {
        console.log("🧪 불러올 travelId:", travelId);
        const token = localStorage.getItem("accessToken");
        console.log("🧪 accessToken:", token);

        axios.get(`http://localhost:8080/traveluser/${travelId}`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        })
            .then(res => {
                console.log("✅ 참여자 목록 raw:", res.data);
                setUsers(res.data);
                setLoadError(false);
            })
            .catch(err => {
                setLoadError(true);
                console.error("❌ 참여자 목록 불러오기 실패:", err);
            });
    }, [travelId]);

    const handleRoleChange = async (targetUserId, newRole) => {
        if (!newRole || typeof newRole !== "string") {
            alert("권한 값이 잘못되었습니다.");
            return;
        }

        try {
            await axios.put("/traveluser/role", null, {
                params: {
                    travelId,
                    userId: targetUserId,
                    roleKey: newRole,
                },
            });

            setUsers(prev =>
                prev.map(user =>
                    user.userId === targetUserId ? { ...user, role: newRole } : user
                )
            );

            setEditedRoles(prev => {
                const newState = { ...prev };
                delete newState[targetUserId];
                return newState;
            });
            alert("권한이 성공적으로 변경되었습니다.");

        } catch (err) {
            console.error("권한 변경 실패:", err);
            alert("권한 변경에 실패했습니다.");
        }
    };

    const handleSearchUser = async () => {
        if (!emailInput) return;
        try {
            const res = await axios.get(`/user/find/${emailInput}`);
            setNewUserInfo(res.data);
        } catch (err) {
            alert("해당 사용자를 찾을 수 없습니다.");
            setNewUserInfo(null);
        }
    };
    //삭제 추가
    const handleRemoveUser = async (targetUserId) => {
        if (!window.confirm("정말 이 사용자를 공유 목록에서 제거하시겠습니까?")) return;

        try {
            await axios.delete(`/traveluser/role`, {  // ✅ 여기 수정
                params: {
                    travelId,
                    userId: targetUserId,
                }
            });

            setUsers(prev => prev.filter(user => user.userId !== targetUserId));
            alert("사용자를 삭제했습니다.");
        } catch (err) {
            console.error("삭제 실패:", err);
            alert("삭제 중 오류가 발생했습니다.");
        }
    };


    const handleInvite = async () => {
        if (!newUserInfo) return;
        try {
            await axios.post(`/traveluser`, null, {
                params: {
                    travelId,
                    userId: newUserInfo.userid,
                    roleKey: "GUEST_READ",
                }
            });
            alert("초대 완료!");
            setUsers([...users, newUserInfo]);
            setNewUserInfo(null);
            setEmailInput("");
        } catch (err) {
            console.error("초대 실패:", err);
            alert("초대 중 오류가 발생했습니다.");
        }
    };

    return (
        <div className="share-popup-overlay">
            <div className="share-wrapper">
                <button className="share-close-button" onClick={onClose}>×</button>
                <h2>공유 설정</h2>

                <div className="current-users">
                    <h4>현재 함께 작업 중인 친구</h4>
                    <ul>
                        {users.map(user => (
                            <li key={user.userId} style={{display: "flex", alignItems: "center", marginBottom: "8px"}}>
      <span style={{flex: "1"}}>
        {user.name || user.userId}{user.email ? ` (${user.email})` : ""} -{" "}
      </span>

                                {isHost && user.userId !== loggedInUserId ? (
                                    <div className="role-actions">
                                        <select
                                            value={editedRoles[user.userId] || user.role}
                                            onChange={(e) =>
                                                setEditedRoles({
                                                    ...editedRoles,
                                                    [user.userId]: e.target.value,
                                                })
                                            }
                                        >
                                            <option value="GUEST_READ">게스트(읽기)</option>
                                            <option value="GUEST_WRITE">게스트(쓰기)</option>
                                        </select>

                                        <button
                                            onClick={() => {
                                                const role = editedRoles[user.userId];
                                                const targetUserId = user.userId;

                                                if (!role || role === user.role) {
                                                    alert("변경된 권한이 없습니다.");
                                                    return;
                                                }

                                                handleRoleChange(targetUserId, role);
                                            }}
                                        >
                                            수정
                                        </button>

                                        <button
                                            onClick={() => {
                                                const targetUserId = user.userId;
                                                handleRemoveUser(targetUserId);
                                            }}
                                        >
                                            삭제
                                        </button>
                                    </div>
                                ) : (
                                    <strong>{roleToLabel[user.role]}</strong>
                                )}

                            </li>
                        ))}
                    </ul>
                    {loadError && <p style={{color: "red"}}>참여자 목록을 불러오지 못했습니다.</p>}
                    {!loadError && users.length === 0 && <p>참여자가 없습니다.</p>}

                </div>

                <div className="invite-section">
                    <h4>친구 초대</h4>
                    <input
                        type="text"
                        placeholder="이메일로 사용자 검색"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                    />
                    <button onClick={handleSearchUser}>검색</button>

                    {newUserInfo && (
                        <div className="invite-result">
                            <p>{newUserInfo.name} ({newUserInfo.email})</p>
                            <button onClick={handleInvite}>초대하기</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ShareSettings;
