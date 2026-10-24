import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import styles from "./TravelAccessGuard.module.css";

// 지금 가진 토큰이 어느 여행의 토큰인지 (로그인 토큰이면 null)
const currentTokenTravelId = () => {
    try {
        return jwtDecode(localStorage.getItem("accessToken")).travelId ?? null;
    } catch (e) {
        return null;
    }
};

/**
 * 일정 화면에 들어가기 전에 이 여행의 토큰을 갖고 있는지 확인한다.
 * - 이미 이 여행의 토큰이면 바로 보여준다.
 * - 다른 여행(또는 로그인) 토큰이면 서버에 이 여행 토큰을 요청한다. 참여자면 받아서 들어가고,
 *   참여자가 아니면(403) 일정 화면을 아예 띄우지 않고 안내 화면을 보여준다.
 */
const TravelAccessGuard = ({ children }) => {
    const { travelId } = useParams();
    const navigate = useNavigate();
    // 토큰이 이 여행 것인지는 렌더할 때마다 직접 확인한다 (주소의 여행 번호가 바뀐 직전 렌더에 예전 화면이 뜨지 않게)
    const hasToken = String(currentTokenTravelId()) === travelId;
    const [status, setStatus] = useState("checking");

    useEffect(() => {
        if (hasToken) return;
        setStatus("checking");

        let cancelled = false;
        axios.post("/auth/switch-travel", { travelId: Number(travelId) })
            .then((res) => {
                if (cancelled) return;
                localStorage.setItem("accessToken", res.data.token);
                setStatus("ok"); // 다시 렌더 → hasToken이 true
            })
            .catch((err) => {
                if (cancelled) return;
                setStatus(err.response?.status === 403 ? "forbidden" : "error");
            });
        return () => { cancelled = true; };
    }, [travelId, hasToken]);

    if (hasToken) return children;

    if (status === "checking" || status === "ok") {
        return <div className={styles.page}><div className={styles.spinner} aria-label="확인 중" /></div>;
    }

    const forbidden = status === "forbidden";
    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <div className={styles.icon} aria-hidden="true">{forbidden ? "🔒" : "⚠️"}</div>
                <h2 className={styles.title}>
                    {forbidden ? "이 여행에 접근할 수 없어요" : "여행 정보를 불러오지 못했어요"}
                </h2>
                <p className={styles.desc}>
                    {forbidden
                        ? "참여 중인 여행만 볼 수 있어요. 여행 호스트에게 초대를 요청해 주세요."
                        : "잠시 후 다시 시도해 주세요."}
                </p>
                <button className={styles.button} onClick={() => navigate("/mypage")}>
                    내 여행 목록으로
                </button>
            </div>
        </div>
    );
};

export default TravelAccessGuard;
