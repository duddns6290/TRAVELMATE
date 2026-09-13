import React, { useState } from 'react';
import './WeatherModal.css';
import { useNavigate } from 'react-router-dom';

function WeatherModal({ isModal }) {
    const [query, setQuery] = useState('');
    const [weatherData, setWeatherData] = useState([]);
    const [error, setError] = useState('');
    const [currentPage, setCurrentPage] = useState(0);
    const navigate = useNavigate();

    const fetchWeatherByCoordinates = async (lat, lng) => {
        try {
            const response = await fetch(`http://localhost:8080/api/weather?lat=${lat}&lng=${lng}`);
            if (!response.ok) throw new Error("날씨 정보 요청 실패");
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

        try {
            setError("");
            setWeatherData([]);
            setCurrentPage(0); // 검색 시 페이지 초기화
            const { lat, lng } = await getCoordinatesFromKeyword(query);
            const data = await fetchWeatherByCoordinates(lat, lng);
            setWeatherData(data);
        } catch (err) {
            setError(err.message || "알 수 없는 오류 발생");
        }
    };

    // 페이징 로직
    const itemsPerPage = 3;
    const pageCount = Math.ceil(weatherData.length / itemsPerPage);
    const startIdx = currentPage * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    const visibleItems = weatherData.slice(startIdx, endIdx);

    const handlePrev = () => {
        setCurrentPage((prev) => Math.max(prev - 1, 0));
    };

    const handleNext = () => {
        setCurrentPage((prev) => Math.min(prev + 1, pageCount - 1));
    };

    return (
        <div className={isModal ? 'modal-overlay' : ''}>
            <div className={isModal ? 'modal-content' : ''}>
                <section className="weather-section">
                    <h2>지역 날씨 조회</h2>
                    <div className="weather-search">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="예: 금오공과대학교"
                        />
                        <button onClick={handleSearchWeather}>조회</button>
                    </div>

                    {error && <p className="error-text">{error}</p>}

                    {weatherData.length > 0 && (
                        <div className="weather-result">
                            <div className="weather-nav">
                                <button onClick={handlePrev} disabled={currentPage === 0}>{'<'}</button>
                                <div className="weather-cards">
                                    {visibleItems.map((day, idx) => (
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
                                <button onClick={handleNext} disabled={currentPage === pageCount - 1}>{'>'}</button>
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}

export default WeatherModal;
