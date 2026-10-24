import React from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
 import Login from "./Login";
import Main from "./Main";
import MyPage from "./MyPage/MyPage";
import Timetable from "./timetable/Timetable";
import TravelAccessGuard from "./timetable/TravelAccessGuard";
import OAuthCallback from "./OAuthCallback";
import { UserProvider } from "./UserContext";
import Tempdetail from "./Temp/Tempdetail";
import ShareSettings from "./Share/ShareSettings";
import WeatherModal from "./Weather/WeatherModal"
import TempList from "./Temp/TempList"
import axios from "axios";
import { jwtDecode } from "jwt-decode";

axios.defaults.baseURL = process.env.REACT_APP_API_BASE;

// 모든 요청에 JWT를 붙인다 (서버는 로그인·공개 API를 빼고 토큰을 요구한다)
axios.interceptors.request.use((config) => {
    const token = localStorage.getItem("accessToken");
    if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Access Token이 만료되면 Refresh Token(HttpOnly 쿠키)으로 재발급받아 원래 요청을 다시 보낸다.
// 동시에 여러 요청이 401을 받아도 재발급은 한 번만 한다.
let refreshing = null;

const refreshAccessToken = () => {
    if (!refreshing) {
        // 보고 있던 여행 토큰이었으면 같은 여행 토큰으로 다시 받는다
        let travelId = null;
        try {
            travelId = jwtDecode(localStorage.getItem("accessToken")).travelId ?? null;
        } catch (e) { /* 토큰 없음 */ }

        // 본문을 null로 보내면 axios가 form 형식(Content-Type)으로 보내므로 항상 JSON 객체로 보낸다
        refreshing = axios.post("/auth/refresh", travelId ? { travelId } : {}, { withCredentials: true })
            .then((res) => {
                localStorage.setItem("accessToken", res.data.token);
                return res.data.token;
            })
            .finally(() => { refreshing = null; });
    }
    return refreshing;
};

const goToLogin = () => {
    localStorage.removeItem("accessToken");
    if (window.location.pathname !== "/login") window.location.href = "/login";
};

axios.interceptors.response.use(
    (res) => res,
    async (error) => {
        const original = error.config;
        // 로그인·재발급·로그아웃 요청의 401은 재발급으로 해결할 수 없다
        const isAuthCall = ["/auth/refresh", "/auth/logout", "/user/login"].some((p) => original?.url?.includes(p));

        if (error.response?.status === 401 && original && !original._retried && !isAuthCall) {
            original._retried = true;
            try {
                const token = await refreshAccessToken();
                original.headers.Authorization = `Bearer ${token}`;
                return axios(original);
            } catch (e) {
                goToLogin(); // Refresh Token도 만료·폐기됨
            }
        }
        return Promise.reject(error);
    }
);

function App() {
    const location = useLocation();
    const state = location.state;
    return (
        <UserProvider>
            <Routes location={state?.backgroundLocation || location}>
                    <Route path="/" element={<Main />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/main" element={<Main />} />
                    <Route path="/mypage" element={<MyPage />} />
                    <Route path="/timetable/:travelId" element={<TravelAccessGuard><Timetable /></TravelAccessGuard>} />
                    <Route path="/tempplace/:id" element={<Tempdetail />} />
                    <Route path="/timetable/:travelId/:period" element={<TravelAccessGuard><Timetable /></TravelAccessGuard>} />
                    <Route path="/oauth2/redirect" element={<OAuthCallback />} />
                <Route path="/tempplace/:id" element={<Tempdetail />} />
                </Routes>
                {state?.backgroundLocation && (
                    <Routes>
                        <Route path="/timetable/:travelId/:period/weather" element={<WeatherModal isModal />} />
                        <Route path="/timetable/:travelId/:period/tempList" element={<TempList isModal />} />
                    </Routes>
                )}
        </UserProvider>
    );
}

export default App;
