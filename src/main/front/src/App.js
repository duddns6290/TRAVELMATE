import React from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
 import Login from "./Login";
import Main from "./Main";
import MyPage from "./MyPage/MyPage";
import Timetable from "./timetable/Timetable";
import PlaceDetail from "./PlaceDetail";
import OAuthCallback from "./OAuthCallback";
import { UserProvider } from "./UserContext";
import Tempdetail from "./Temp/Tempdetail";
import ShareSettings from "./Share/ShareSettings";
import WeatherModal from "./Weather/WeatherModal"
import TempList from "./Temp/TempList"
import axios from "axios";

axios.defaults.baseURL = process.env.REACT_APP_API_BASE;

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
                    <Route path="/timetable/:travelId" element={<Timetable />} />
                    <Route path="/tempplace/:id" element={<Tempdetail />} />
                    <Route path="/timetable/:travelId/:period" element={<Timetable />} />
                    <Route path="/place/:id" element={<PlaceDetail />} />
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
