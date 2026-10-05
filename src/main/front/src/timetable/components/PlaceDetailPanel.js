import React, { useEffect, useState } from "react";
import axios from "axios";
import styles from "../Timetable.module.css";

const TABS = [
    { key: "info", label: "정보" },
    { key: "review", label: "리뷰" },
    { key: "blog", label: "블로그" },
    { key: "youtube", label: "유튜브" },
];

const parseBlogs = (raw) =>
    (Array.isArray(raw) ? raw : [])
        .map(item => {
            try {
                return JSON.parse(item);
            } catch (e) {
                return null;
            }
        })
        .filter(Boolean);

// "url1,url2" 형태 문자열/배열을 URL 배열로. 블로그 썸네일의 "#3000x2250" 같은 크기 표기는 제거
const toUrls = (value) =>
    (Array.isArray(value) ? value : [value])
        .flatMap(v => (v || "").split(","))
        .map(u => u.trim().replace(/#\d+x\d+$/, ""))
        .filter(Boolean);

// 네이버 리뷰 사진(pstatic)은 ?type=w1500... 원본이라 썸네일은 작은 크기로 요청한다
const thumbUrl = (url) =>
    url.includes("pstatic.net") ? url.replace(/([?&]type=)[^&]*/, "$1w560_sharpen") : url;

// 네이버 이미지 서버는 외부 referrer를 막는 경우가 있어 referrer 없이 불러온다
const Img = (props) => <img referrerPolicy="no-referrer" loading="lazy" alt="" {...props} />;

// 리뷰 한 개: 작성자/날짜, 사진 줄, 길면 접히는 본문
const ReviewCard = ({ review, onPhotoClick }) => {
    const [expanded, setExpanded] = useState(false);
    const isLong = (review.text || "").length > 120;
    return (
        <div className={styles.reviewCard}>
            <div className={styles.reviewHead}>
                <div className={styles.reviewAvatar}>{(review.nickname || "익")[0]}</div>
                <div className={styles.reviewWho}>
                    <div className={styles.reviewNick}>{review.nickname || "익명"}</div>
                    {review.date && <div className={styles.reviewDate}>{review.date}</div>}
                </div>
            </div>

            {review.photos.length > 0 && (
                <div className={styles.photoStrip}>
                    {review.photos.map((url, i) => (
                        <Img
                            key={i}
                            src={thumbUrl(url)}
                            className={styles.photoThumb}
                            onClick={() => onPhotoClick(review.photos, i)}
                        />
                    ))}
                </div>
            )}

            <p className={`${styles.reviewText} ${!expanded && isLong ? styles.clamp4 : ""}`}>{review.text}</p>
            {isLong && (
                <button className={styles.moreButton} onClick={() => setExpanded(v => !v)}>
                    {expanded ? "접기" : "더보기"}
                </button>
            )}
        </div>
    );
};

// 타임라인 옆으로 열리는 장소 상세 패널
const PlaceDetailPanel = ({ placeId, onClose }) => {
    const [tab, setTab] = useState("info");
    const [place, setPlace] = useState(null);
    const [error, setError] = useState(false);
    const [reviews, setReviews] = useState(null);
    const [blogs, setBlogs] = useState(null);
    const [videos, setVideos] = useState(null);
    const [lightbox, setLightbox] = useState(null); // { images, index }

    // 다른 장소를 열면 초기화
    useEffect(() => {
        setTab("info");
        setPlace(null);
        setError(false);
        setReviews(null);
        setBlogs(null);
        setVideos(null);
        setLightbox(null);

        axios.get(`/restaurant/info/${placeId}`)
            .then(res => setPlace(res.data))
            .catch(err => {
                console.error("가게 정보 불러오기 실패", err);
                setError(true);
            });
    }, [placeId]);

    // 탭은 처음 열 때 한 번만 불러온다
    useEffect(() => {
        if (tab === "review" && reviews === null) {
            axios.get(`/restaurant/review/${placeId}`)
                .then(res => {
                    const { reviews = [], reviewDates = [], reviewNicknames = [], reviewPhotosList = [] } = res.data || {};
                    setReviews(reviews.map((text, i) => ({
                        text,
                        date: reviewDates[i],
                        nickname: reviewNicknames[i],
                        photos: toUrls(reviewPhotosList?.[i]),
                    })));
                })
                .catch(() => setReviews([]));
        } else if (tab === "blog" && blogs === null) {
            axios.get(`/restaurant/blog/${placeId}`)
                .then(res => setBlogs(parseBlogs(res.data?.blogReviews)))
                .catch(() => setBlogs([]));
        } else if (tab === "youtube" && videos === null && place?.title) {
            axios.get(`/youtube/search`, { params: { keyword: place.title } })
                .then(res => setVideos(res.data || []))
                .catch(() => setVideos([]));
        }
    }, [tab, placeId, place, reviews, blogs, videos]);

    const loading = <div className={styles.detailEmpty}>불러오는 중...</div>;

    return (
        <div className={styles.detailPanel}>
            <div className={styles.detailPanelTop}>
                <button className={styles.detailClose} onClick={onClose} aria-label="닫기">×</button>
            </div>

            {error ? (
                <div className={styles.detailEmpty}>상세 정보를 불러올 수 없는 장소입니다.</div>
            ) : !place ? (
                loading
            ) : (
                <>
                    {place.titleImg && (
                        <div className={styles.detailHero} style={{ backgroundImage: `url('${place.titleImg}')` }} />
                    )}
                    <h3 className={styles.detailTitle}>{place.title}</h3>
                    <div className={styles.detailAddress}>📍 {place.address}</div>

                    <div className={styles.detailTabs}>
                        {TABS.map(t => (
                            <button
                                key={t.key}
                                className={`${styles.detailTab} ${tab === t.key ? styles.detailTabActive : ""}`}
                                onClick={() => setTab(t.key)}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    <div className={styles.detailBody}>
                        {tab === "info" && (
                            <div className={styles.detailInfo}>
                                <div className={styles.detailRow}>
                                    <span className={styles.detailLabel}>운영 시간</span>
                                    <div>
                                        {place.wk
                                            ? place.wk.split("|").map((line, i) => <div key={i}>{line.trim()}</div>)
                                            : "정보 없음"}
                                    </div>
                                </div>
                                <div className={styles.detailRow}>
                                    <span className={styles.detailLabel}>휴무일</span>
                                    <div>{place.holiday || "정보 없음"}</div>
                                </div>
                                <div className={styles.detailRow}>
                                    <span className={styles.detailLabel}>머무는 시간</span>
                                    <div>{place.stayTime ? `${place.stayTime}분` : "정보 없음"}</div>
                                </div>
                            </div>
                        )}

                        {tab === "review" && (reviews === null ? loading : reviews.length === 0 ? (
                            <div className={styles.detailEmpty}>리뷰가 없습니다.</div>
                        ) : (
                            <>
                                {(() => {
                                    const allPhotos = reviews.flatMap(r => r.photos);
                                    return allPhotos.length > 0 && (
                                        <div className={styles.photoSection}>
                                            <div className={styles.sectionLabel}>리뷰 사진 {allPhotos.length}</div>
                                            <div className={styles.photoGrid}>
                                                {allPhotos.slice(0, 6).map((url, i) => (
                                                    <div key={i} className={styles.photoGridItem} onClick={() => setLightbox({ images: allPhotos, index: i })}>
                                                        <Img src={thumbUrl(url)} />
                                                        {i === 5 && allPhotos.length > 6 && (
                                                            <span className={styles.photoMore}>+{allPhotos.length - 6}</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}
                                <div className={styles.sectionLabel}>리뷰 {reviews.length}</div>
                                {reviews.map((r, i) => (
                                    <ReviewCard
                                        key={i}
                                        review={r}
                                        onPhotoClick={(images, index) => setLightbox({ images, index })}
                                    />
                                ))}
                            </>
                        ))}

                        {tab === "blog" && (blogs === null ? loading : blogs.length === 0 ? (
                            <div className={styles.detailEmpty}>블로그 리뷰가 없습니다.</div>
                        ) : blogs.map((b, i) => {
                            const thumbs = toUrls(b.thumbnailUrlList);
                            return (
                                <a key={i} className={styles.blogCard} href={b.url} target="_blank" rel="noopener noreferrer">
                                    {thumbs.length > 0 && (
                                        <div className={styles.blogThumbWrap}>
                                            <Img src={thumbs[0]} className={styles.blogThumb} />
                                            {thumbs.length > 1 && <span className={styles.blogThumbCount}>📷 {thumbs.length}</span>}
                                        </div>
                                    )}
                                    <div className={styles.blogBody}>
                                        <div className={`${styles.blogTitle} ${styles.clamp2}`}>{b.title}</div>
                                        {b.contents && <p className={`${styles.blogText} ${styles.clamp3}`}>{b.contents}</p>}
                                        <div className={styles.blogMeta}>
                                            <span>✍️ {b.authorName || "블로거"}</span>
                                            <span>{b.createdString}</span>
                                        </div>
                                    </div>
                                </a>
                            );
                        }))}

                        {tab === "youtube" && (videos === null ? loading : videos.length === 0 ? (
                            <div className={styles.detailEmpty}>관련 영상이 없습니다.</div>
                        ) : videos.map((v, i) => (
                            <a key={i} className={styles.detailCard} href={v.videoUrl} target="_blank" rel="noopener noreferrer">
                                {v.thumbnailUrl && <img className={styles.detailVideoThumb} src={v.thumbnailUrl} alt={v.title} />}
                                <div className={styles.detailCardTitle}>{v.title}</div>
                                <div className={styles.detailCardMeta}>
                                    <span>{v.channelTitle}</span>
                                    <span>
                                        {v.publishedAt?.split("T")[0]}
                                        {v.viewCount != null && ` · 조회수 ${Number(v.viewCount).toLocaleString()}회`}
                                    </span>
                                </div>
                            </a>
                        )))}
                    </div>
                </>
            )}

            {lightbox && (
                <div className={styles.lightbox} onClick={() => setLightbox(null)}>
                    <Img src={lightbox.images[lightbox.index]} className={styles.lightboxImg} onClick={(e) => e.stopPropagation()} />
                    {lightbox.images.length > 1 && (
                        <>
                            <button
                                className={`${styles.lightboxNav} ${styles.lightboxPrev}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setLightbox(l => ({ ...l, index: (l.index - 1 + l.images.length) % l.images.length }));
                                }}
                            >‹</button>
                            <button
                                className={`${styles.lightboxNav} ${styles.lightboxNext}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setLightbox(l => ({ ...l, index: (l.index + 1) % l.images.length }));
                                }}
                            >›</button>
                            <div className={styles.lightboxCount}>{lightbox.index + 1} / {lightbox.images.length}</div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default PlaceDetailPanel;
