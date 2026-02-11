// src/pages/Login.js
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./Login.css"; // 스타일 분리

const Login = () => {
    const [userid, setUserId] = useState("");
    const [userpw, setUserPw] = useState("");
    const [message, setMessage] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        const queryParams = new URLSearchParams(window.location.search);

    }, [navigate]);

    const handleLogin = async () => {
        if (!userid || !userpw) {
            setMessage("아이디와 비밀번호를 입력하세요.");
            return;
        }

        try {
            const response = await axios.post("http://localhost:8080/user/login", {
                userid,
                userpw
            });

            if (response.data === userid) {
                sessionStorage.setItem("userId", userid);

                setMessage("로그인 성공!");
                setTimeout(() => {
                    window.location.href = "/";
                }, 500);
            } else {
                setMessage("로그인 실패: " + response.data.message);
            }
        } catch (error) {
            setMessage("서버 오류 발생");
            console.error("로그인 요청 실패:", error);
        }
    };

    const handleOAuthLogin = (provider) => {
        window.location.href = `http://localhost:8080/oauth2/authorization/${provider}`;
    };

    return (
        <div className="login-wrapper">
            <h1 className="login-logo">
                <span className="login-logo-main">Travel</span>
                <span className="login-logo-sub">Mate</span>
            </h1>

            <div className="login-container">
                <h2 className="login-title">로그인</h2>

                <input
                    type="text"
                    placeholder="아이디"
                    value={userid}
                    onChange={(e) => setUserId(e.target.value)}
                    className="login-input"
                />
                <input
                    type="password"
                    placeholder="비밀번호"
                    value={userpw}
                    onChange={(e) => setUserPw(e.target.value)}
                    className="login-input"
                />

                <button onClick={handleLogin} className="login-button">로그인</button>

                {message && <p className="login-message">{message}</p>}

                <div className="login-oauth-container">
                    {/*<button onClick={() => handleOAuthLogin("naver")} className="naver-button">Naver 로그인</button>*/}
                    <button onClick={() => handleOAuthLogin("kakao")} className="kakao-button">Kakao 로그인</button>
                </div>
            </div>
        </div>
    );
};

export default Login;
