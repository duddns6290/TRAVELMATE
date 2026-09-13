import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import "./PlaceDetail.css";

const PlaceDetail = () => {
    const { id } = useParams();
    const [tab, setTab] = useState("info"); // "info", "review", "blog"
    const [place, setPlace] = useState(null);
    const [reviews, setReviews] = useState([]);
    const [blogs, setBlogs] = useState([]);
    const [youtubeVideos, setYoutubeVideos] = useState([]);

    useEffect(() => {
        const fetchPlace = async () => {
            try {
                const res = await axios.get(`/restaurant/info/${id}`);
                console.log("place 데이터", res.data); // 확인용 로그

                setPlace(res.data);
            } catch (err) {
                console.error("가게 정보 불러오기 실패", err);
            }
        };
        fetchPlace();
    }, [id]);
    useEffect(() => {
        if (
            tab === "info" &&
            window.naver &&
            place &&
            place.lat !== null &&
            place.lon !== null
        ) {
            const lat = Number(place.lat);
            const lon = Number(place.lon);

            // 유효한 숫자인지까지 검사
            if (!isNaN(lat) && !isNaN(lon)) {
                const location = new window.naver.maps.LatLng(lat, lon);

                const map = new window.naver.maps.Map("map", {
                    center: location,
                    zoom: 16,
                });

                new window.naver.maps.Marker({
                    position: location,
                    map: map,
                });
            }
        }
    }, [tab, place]);

    useEffect(() => {
        console.log("현재 탭:", tab);

        if (tab === "review") {
            axios.get(`/restaurant/review/${id}`)
                .then(res => {
                    const {
                        reviews = [],
                        reviewDates = [],
                        reviewNicknames = []
                    } = res.data;

                    setPlace(prev => ({
                        ...prev,
                        reviews,
                        reviewDates,
                        reviewNicknames
                    }));

                    console.log("전체 리뷰 데이터:", {
                        reviews,
                        reviewDates,
                        reviewNicknames
                    });

                    reviews.forEach((text, i) => {
                        console.log(`📝 [${reviewDates[i] || "-"}] ${reviewNicknames[i] || "익명"}: ${text}`);
                    });
                })
                .catch(err => console.error(" 리뷰 불러오기 실패", err));
        }

        else if (tab === "blog") {
            console.log("현재 ", tab);

            axios.get(`/restaurant/blog/${id}`)
                .then(res => {
                    console.log("원본 응답:", res.data);

                    const raw = res.data.blogReviews;

                    if (!raw || !Array.isArray(raw)) {
                        console.warn("blogReviews 없음 또는 배열 아님:", raw);
                        setBlogs([]);
                        return;
                    }

                    const parsed = raw.map((item, index) => {
                        try {
                            const parsedItem = JSON.parse(item);

                            if (Array.isArray(parsedItem.thumbnailUrlList)) {
                                parsedItem.thumbnailUrlList = parsedItem.thumbnailUrlList
                                    .flatMap(url => url.split(",").map(str => str.trim()));
                            }

                            console.log(`블로그 ${index + 1}:`, parsedItem);
                            return parsedItem;
                        } catch (e) {
                            console.error(`블로그 JSON 파싱 실패 (index ${index})`, item, e);
                            return null;
                        }
                    }).filter(Boolean);

                    setBlogs(parsed);
                    console.log("최종 블로그 데이터:", parsed);
                })
                .catch(err => console.error("블로그 불러오기 실패", err));
        }else if (tab === "youtube") {
            if (!place?.title) return;

            axios.get(`/youtube/search`, {
                params: { keyword: place.title }
            })
                .then(res => {
                    console.log("유튜브 결과:", res.data);
                    setYoutubeVideos(res.data || []);
                })
                .catch(err => {
                    console.error("유튜브 영상 불러오기 실패", err);
                    setYoutubeVideos([]);
                });
        }


    }, [tab, id]);



    if (!place) return <div>로딩 중...</div>;
    return (
        <div className="place-detail-container">
            <h2 className="place-title">{place.title}</h2>

            <div className="tab-buttons">
                <button className={`tab-button ${tab === "info" ? "active" : ""}`} onClick={() => setTab("info")}>가게
                    정보
                </button>
                <button className={`tab-button ${tab === "review" ? "active" : ""}`}
                        onClick={() => setTab("review")}>리뷰
                </button>
                <button className={`tab-button ${tab === "blog" ? "active" : ""}`} onClick={() => setTab("blog")}>블로그
                </button>
                <button className={`tab-button ${tab === "youtube" ? "active" : ""}`}
                        onClick={() => setTab("youtube")}>유튜브
                </button>
            </div>


            {tab === "info" && (
                <div className="place-info-section">
                    <div className="place-info-left">
                        <img className="place-image" src={place.titleImg} alt={place.title}/>
                        <div className="place-info">
                            <p><strong>주소:</strong> {place.address}</p>
                            <p><strong>운영 시간:</strong></p>
                            <div className="open-hours">
                                {place.wk.split("|").map((line, i) => (
                                    <div key={i} className="open-hour-line">🕒 {line.trim()}</div>
                                ))}
                            </div>
                            <p><strong>휴무일:</strong> {place.holiday || "정보 없음"}</p>
                            <p><strong>머무르는 시간:</strong> {place.stayTime || "정보 없음"}분</p>
                        </div>
                    </div>

                    <div className="place-info-map">
                        <div id="map" className="map-box"></div>
                    </div>
                </div>
            )}


            {tab === "review" && (
                <div>
                    <h3>리뷰 목록</h3>
                    {!place.reviews || place.reviews.length === 0 ? (
                        <p>리뷰 없음</p>
                    ) : (
                        place.reviews.map((text, i) => (
                            <div key={i} className="review-box">
                                <div className="review-header">
                                    <span className="review-nickname">👤 {place.reviewNicknames?.[i] || "익명"}</span>
                                    <span className="review-date">🗓 {place.reviewDates?.[i] || "-"}</span>
                                </div>
                                <p className="review-content">{text}</p>
                            </div>
                        ))
                    )}
                </div>
            )}


            {tab === "blog" && (
                <div>
                    <h3>블로그 리뷰</h3> 
                    {blogs.length === 0 ? (
                        <p>블로그 리뷰 없음</p>
                    ) : (
                        blogs.map((b, i) => (
                            <div key={i} className="blog-card">
                                <a href={b.url} target="_blank" rel="noopener noreferrer">
                                    <h4>{b.title}</h4>
                                </a>
                                <p><strong>작성자:</strong> {b.authorName} | <strong>작성일:</strong> {b.createdString}</p>
                                <p>{b.contents?.slice(0, 100)}...</p>

                            </div>
                        ))
                    )}
                </div>
            )}
            {tab === "youtube" && (
                <div>
                    <h3>관련 유튜브 영상</h3>
                    {youtubeVideos.length === 0 ? (
                        <p>유튜브 영상 없음</p>
                    ) : (
                        <div className="youtube-grid">
                            {youtubeVideos.map((video, i) => (
                                <div key={i} className="youtube-card">
                                    <a href={video.videoUrl} target="_blank" rel="noopener noreferrer">
                                        <img src={video.thumbnailUrl} alt={video.title} />
                                        <p className="youtube-title">{video.title}</p>
                                    </a>
                                    <p className="youtube-channel">채널명: {video.channelTitle}</p>
                                    <p className="youtube-date">게시일: {video.publishedAt?.split("T")[0]}</p>
                                    <p className="youtube-views">조회수: {Number(video.viewCount).toLocaleString()}회</p>
                                </div>
                            ))}

                        </div>
                    )}
                </div>
            )}

        </div>
    );

};

export default PlaceDetail;
