/* global naver */
import React, {useContext, useEffect, useState} from "react";
import "./Main.css";
import "./Login.js"
import ImageSlider from "./ImageSlider";
import { useNavigate } from "react-router-dom";
import { UserContext } from "./UserContext";

const Main = () => {
    const { userId } = useContext(UserContext);
    const navigate = useNavigate();
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [query, setQuery] = useState("");
    const [weatherData, setWeatherData] = useState([]);
    const [error, setError] = useState("");

    useEffect(() => {
        setIsLoggedIn(!!userId);
    }, [userId]);

    //날씨 정보 받아오기
    const fetchWeatherByCoordinates = async (lat, lng) => {
        try {
            const response = await fetch(`http://localhost:8080/api/weather?lat=${lat}&lng=${lng}`);
            if (!response.ok) {
                throw new Error("날씨 정보 요청 실패");
            }
            const data = await response.json();
            return data;
        } catch (error) {
            throw error;
        }
    };


    const getCoordinatesFromKeyword = async (keyword) => {
        return new Promise((resolve, reject) => {
            const ps = new window.kakao.maps.services.Places();
            ps.keywordSearch(keyword, (data, status) => {
                if (status !== window.kakao.maps.services.Status.OK || !data.length) {
                    reject("장소 검색 실패");
                    return;
                }
                const place = data[0];
                resolve({ lat: parseFloat(place.y), lng: parseFloat(place.x) });
            });
        });
    };


    const handleSearchWeather = async () => {
        if (!query.trim()) {
            setError("장소명을 입력해주세요.");
            return;
        }
        console.log("버튼 클릭!!")
        try {
            setError("");
            setWeatherData([]);

            const { lat, lng } = await getCoordinatesFromKeyword(query);
            const data = await fetchWeatherByCoordinates(lat, lng);
            console.log("데이터", data)
            setWeatherData(data);

        } catch (err) {
            setError(err.message || "알 수 없는 오류 발생");
        }
    };





    const goToLogin = () => {
        navigate("/login");
    };

    const goToMyPage = () => {
        navigate("/mypage");
    };

    const handleLogout = () => {
        setIsLoggedIn(false);
    };
    const seoulImages = [
        "/images/seoul01.jpg",
        "/images/seoul02.jpg",
        "/images/seoul03.jpg",
        "/images/seoul04.jpg",
        "/images/seoul05.jpg"
    ];

    const summerImages = [
        "/images/summer01.jpeg",
        "/images/summer02.webp",
        "/images/summer03.jpg",
        "/images/summer04.jpg",
        "/images/summer05.jpg"
    ];

    var loginFlag = false
    return (
        <div className="main-wrapper">
            {/* Header */}
            <header className="main-header">
                <div className="logo">TravelMate</div>
                <nav className="nav-bar">
                    {isLoggedIn ? (
                        <>
                            <button onClick={goToMyPage}>마이페이지</button>
                            <button onClick={handleLogout}>로그아웃</button>
                        </>
                    ) : (
                        <button onClick={goToLogin}>로그인</button>
                    )}
                </nav>
            </header>

            <section className="hero-intro">
                <h1 className="hero-title">세상에 하나뿐인 나만의 여행 플랜</h1>
                <p className="hero-subtitle">
                    친구와 함께 떠나는 여행, <strong>TravelMate</strong>에서 시작하세요!
                </p>
            </section>

            <section className="popular-destinations">
                <h2>인기 여행지</h2>
                <ImageSlider images={seoulImages}/>
            </section>

            <section className="popular-destinations">
                <h2>여름 추천 여행지</h2>
                <ImageSlider images={summerImages}/>
            </section>

            <section className="weather-section">
                <h2>지역 날씨 조회</h2>
                <div className="weather-search">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="예: 서울"
                    />
                    <button onClick={handleSearchWeather}>조회</button>
                </div>
                {error && <p className="error-text">{error}</p>}
                {weatherData.length > 0 && (
                    <div className="weather-result">
                        {weatherData.slice(0, 3).map((day, idx) => (
                            <div key={idx} className="weather-card">
                                <p><strong>{day.date}</strong></p>
                                <p>최고기온: {day.tempMax}°C</p>
                                <p>최저기온: {day.tempMin}°C</p>
                                <p>강수량: {day.precip}mm</p>
                                <p>풍속: {day.windSpeed}km/h</p>
                                <p>날씨: {day.precipType}</p>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

export default Main;