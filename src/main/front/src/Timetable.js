/* global naver */
import React, { useState, useEffect } from "react";
import {useNavigate, useParams, useLocation, Link } from "react-router-dom";
import styles from "./Timetable.module.css";
import Map from "./Map/Map";
import axios from "axios";
import PlaceRegister from "./Temp/PlaceRegister";

import {
    DndContext, closestCenter, PointerSensor, useSensor, useSensors,} from "@dnd-kit/core";
import {
    arrayMove, SortableContext, verticalListSortingStrategy, useSortable,} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const defaultImage = "https://capstone12345-bu.s3.ap-northeast-2.amazonaws.com/memo/1748504910375_%EC%9D%B4%EB%AF%B8%EC%A7%80%20%EC%97%86%EC%9D%8C.png";

const Timetable = () => {
    const location = useLocation();
    const { travelId } = useParams();
    const navigate = useNavigate();
    const [selectedDay, setSelectedDay] = useState(1);
    const { period } = location.state || {};
    const [schedule, setSchedule] = useState({});
    const [visibleTransportIndex, setVisibleTransportIndex] = useState(null);
    const [dayPageIndex, setDayPageIndex] = useState(0); // 페이지 인덱스 (0부터 시작)
    const daysPerPage = 3;
    const [showPlaceList, setShowPlaceList] = useState(false);
    const [showRegisterForm, setShowRegisterForm] = useState(false);
    const [isLoadingRoute, setIsLoadingRoute] = useState(false);


    const sortPlacesByNextPlaceId = (places) => {
        if (!places || places.length === 0) return [];

        const idToPlaceMap = {};
        const nextIdSet = new Set();

        places.forEach(place => {
            idToPlaceMap[place.id] = place;
            if (place.nextPlaceId !== null) {
                nextIdSet.add(place.nextPlaceId.toString());
            }
        });

        // 시작점: nextPlaceId로 참조되지 않은 장소 (즉, 시작점)
        const start = places.find(p => !nextIdSet.has(p.id.toString()));
        if (!start) return places; // 순환 참조 등 오류 예방

        const result = [];
        let current = start;

        while (current) {
            result.push(current);
            const nextId = current.nextPlaceId;
            current = nextId ? idToPlaceMap[nextId.toString()] : null;
        }

        return result;
    };

    const formatTime = (timeStr) => {
        if (!timeStr || typeof timeStr !== "string") return null;

        if (timeStr === "00:00:00") return "미정";

        const [hourStr, minuteStr] = timeStr.split(":");
        if (!hourStr || !minuteStr) return null;

        return `${hourStr.padStart(2, '0')}:${minuteStr.padStart(2, '0')}`;
    };

    useEffect(() => {
        if (!period) return;

        const initialSchedule = {};
        for (let i = 1; i <= period; i++) {
            initialSchedule[i] = [];
        }
        setSchedule(initialSchedule);
    }, [period]);


    useEffect(() => {
        if (!travelId || !period) return;

        const fetchSchedule = async () => {
            try {
                const res = await axios.get(`http://localhost:8080/place/travel/${travelId}`);
                const placeList = res.data;

                // 1. 메모 가져오기
                const memoPromises = placeList.map(place =>
                    axios.get(`http://localhost:8080/memos/place/${place.place_id}`)
                        .then(res => ({ placeId: place.place_id, memos: res.data }))
                        .catch(() => ({ placeId: place.place_id, memos: [] }))
                );

                const memoResults = await Promise.all(memoPromises);
                const memoMap = {};
                memoResults.forEach(({ placeId, memos }) => {
                    memoMap[placeId] = (Array.isArray(memos) ? memos : []).map((memo, index) => {
                        const contents = [];
                        if (memo.memoText) contents.push({ type: "text", content: memo.memoText });
                        if (memo.memoExtraLink) contents.push({ type: "link", content: memo.memoExtraLink });
                        if (memo.memoImage) contents.push({ type: "image", content: memo.memoImage });
                        return { title: memo.memoTitle || `메모 ${index + 1}`, contents };
                    });
                });

                // 2. 이동시간 추가
                for (let i = 0; i < placeList.length - 1; i++) {
                    const from = placeList[i];
                    const to = placeList[i + 1];
                    if (from.selected_day !== to.selected_day) continue;

                    try {
                        const moveRes = await axios.get(`http://localhost:8080/movetime/departure/${from.place_id}`);
                        const moveTimeData = moveRes.data?.[0];
                        if (moveTimeData) {
                            from.travelTime = `${moveTimeData.time} / ${moveTimeData.distance}`;
                            from.type = moveTimeData.type;
                            from.moveTimeId = moveTimeData.id;
                            from.placeUrl = moveTimeData.url;
                        }
                    } catch (err) {
                        console.warn(`이동시간 조회 실패 (place_id: ${from.place_id})`, err);
                    }
                }

                // 3. 스케줄 맵 생성
                const scheduleMap = {};
                for (let i = 1; i <= period; i++) {
                    scheduleMap[i] = [];
                }

                placeList.forEach(place => {
                    const day = place.selected_day;
                    if (!day) return;

                    const item = {
                        id: place.place_id.toString(),
                        name: place.place_name,
                        address: place.place_address,
                        image: place.place_image,
                        businessHour: place.place_business_hour,
                        holiday: place.place_holiday,
                        stayTime: place.stay_time,
                        nextPlaceId: place.next_place_id,
                        time: formatTime(place.place_visiting_time),
                        latitude: place.latitude,
                        longitude: place.longitude,
                        travelId: place.travelId,
                        selectedDay: place.selected_day,
                        mongo: place.mongo,
                        travelTime: place.travelTime || null,
                        type: place.type || null,
                        moveTimeId: place.moveTimeId || null,
                        placeUrl: place.placeUrl || null,
                        memos: memoMap[place.place_id] || [],
                        showMemoPanel: false
                    };

                    scheduleMap[day].push(item);
                });


                Object.keys(scheduleMap).forEach(day => {
                    scheduleMap[day] = sortPlacesByNextPlaceId(scheduleMap[day]);
                });

                setSchedule(scheduleMap);

            } catch (err) {
                console.error("전체 일정 불러오기 실패:", err);
            }
        };

        fetchSchedule();

        // 이벤트로 새로고침 처리
        const handleRefresh = () => fetchSchedule();
        window.addEventListener("refresh-timetable", handleRefresh);
        return () => window.removeEventListener("refresh-timetable", handleRefresh);
    }, [travelId, period]);

    // 시간

    const handleSaveTime = async (i, timeStr) => {
        const arr = [...schedule[selectedDay]];
        const place = arr[i];
        if (!place || !place.id) return;

        try {
            await axios.put(`http://localhost:8080/place/${place.id}/visiting-time`, null, {
                params: { time: timeStr },
            });

            place.time = timeStr; // 프론트 상태도 갱신
            setSchedule(prev => ({ ...prev, [selectedDay]: arr }));
            console.log("방문시간 저장 완료");
        } catch (err) {
            console.error("방문시간 저장 실패", err);
            alert("방문시간 저장 중 오류 발생");
        }
    };

    //이동시간 삭제
    const handleMoveTimeDelete = async (i) => {
        const arr = [...schedule[selectedDay]];
        const place = arr[i];

        if (!place || !place.id || !place.moveTimeId) {
            alert("이동시간 정보를 찾을 수 없습니다.");
            return;
        }

        if(activeMode !== "edit"){
            const confirmed = window.confirm("이 이동시간을 삭제하시겠습니까?");
            if (!confirmed) return;
        }

        try {
            await axios.delete(`http://localhost:8080/movetime/${place.moveTimeId}`);
            console.log("이동시간 삭제 완료");

            // 프론트 상태 업데이트
            arr[i].travelTime = null;
            arr[i].type = null;
            arr[i].moveTimeId = null;

            setSchedule(prev => ({ ...prev, [selectedDay]: arr }));
        } catch (err) {
            console.error("이동시간 삭제 실패", err);
            alert("서버 오류로 이동시간 삭제에 실패했습니다.");
        }
    };

    // 모달 타입: null | "place" | "time" | "memo" | "editHelp"
    const [modal, setModal] = useState(null);
    // 모드: null | "edit" | "delete" | "time"
    const [activeMode, setActiveMode] = useState(null);
    // 시간/메모용 선택 인덱스
    const [selectedIndex, setSelectedIndex] = useState(null);
    // 편집용 선택 인덱스
    const [selectedEditIndex, setSelectedEditIndex] = useState(null);

    // 새 입력 상태
    const [newPlace, setNewPlace] = useState({ name: "", category: "음식점" });
    const [newTime, setNewTime]     = useState("");
    const [memoText, setMemoText]   = useState("");

    // 편집 도움말 표시 여부 (localStorage 기반)
    const [showEditHelp, setShowEditHelp] = useState(() => {
        return localStorage.getItem("showEditHelp") !== "false";
    });
    const [dontShowAgain, setDontShowAgain] = useState(false);

    const [moveInsertIndex, setMoveInsertIndex] = useState(null);
    const [showTransportModal, setShowTransportModal] = useState(false);

    // 편집 모드로 진입할 때만 안내창 띄우기
    useEffect(() => {
        if (activeMode === "edit" && showEditHelp) {
            setModal("editHelp");
        }
    }, [activeMode, showEditHelp]);

    const closeEditHelp = () => {
        setModal(null);
        if (dontShowAgain) {
            localStorage.setItem("showEditHelp", "false");
            setShowEditHelp(false);
        }
    };
    const [memoTitle, setMemoTitle] = useState("");
    const [textContent, setTextContent] = useState("");
    const [linkContent, setLinkContent] = useState("");
    const [imageFile, setImageFile] = useState(null);
    const [isAddingToExisting, setIsAddingToExisting] = useState(false);
    const [targetMemoTitle, setTargetMemoTitle] = useState("");

    const toggleMemoPanel = idx => {
        const arr = [...schedule[selectedDay]];
        const currentlyOpen = arr[idx].showMemoPanel;

        // 모두 닫고, 클릭한 항목은 반대로 설정
        arr.forEach((item, i) => (arr[i].showMemoPanel = false));
        arr[idx].showMemoPanel = !currentlyOpen;

        setSchedule(prev => ({ ...prev, [selectedDay]: arr }));
    };

    const closeMemoPanel = () => {
        const arr = [...schedule[selectedDay]];
        arr.forEach((item, i) => (arr[i].showMemoPanel = false));
        setSchedule(prev => ({ ...prev, [selectedDay]: arr }));
        setIsAddingToExisting(false);
        setTargetMemoTitle("");
    };


    const handleSelectTransport = async (type, index) => {
        const arr = [...schedule[selectedDay]];
        const from = arr[index];
        const to = arr[index + 1];

        if (!from || !to) return;

        try {
            setIsLoadingRoute(true);

            const res = await axios.get("http://localhost:8080/api/route/v2", {
                params: {
                    fromName: from.name,
                    fromLat: from.latitude,
                    fromLon: from.longitude,
                    toName: to.name,
                    toLat: to.latitude,
                    toLon: to.longitude,
                    mode: type.includes("자동차") ? "car" : type.includes("도보") ? "walk" : "transmit",
                }
            });

            if (res.data.estimatedTime.includes("크롤링 실패")) {
                alert("🚨 크롤링에 실패했습니다. 다시 시도해주세요.");
                return;
            }

            const estimatedTime = res.data.estimatedTime;
            const routeUrl = res.data.url;
            const [timeStr, distanceStr] = estimatedTime.split("/");

            // 상태 업데이트
            arr[index] = {
                ...from,
                type,
                travelTime: estimatedTime || "미정",
                placeUrl: routeUrl
            };

            setSchedule(prev => ({ ...prev, [selectedDay]: arr }));
            setVisibleTransportIndex(null);
            setActiveMode(null);

            const moveTimePayload = {
                type,
                time: timeStr,
                distance: distanceStr,
                departurePlace: Number(from.id),
                url: routeUrl
            };
            console.log("이동시간 보내는 정보 ", moveTimePayload);
            if (from.moveTimeId) {
                await axios.put(`http://localhost:8080/movetime/${from.moveTimeId}`, moveTimePayload, {
                    headers: { "Content-Type": "application/json" }
                });
                console.log("이동시간 수정 완료");
            } else {
                const result = await axios.post("http://localhost:8080/movetime", moveTimePayload, {
                    headers: {"Content-Type": "application/json"}
                });
                const newMoveTimeId = result.data?.id;
                arr[index].moveTimeId = newMoveTimeId;
                setSchedule(prev => ({...prev, [selectedDay]: arr}));
                console.log("이동시간 등록 완료");
            }
        } catch (err) {
            console.error("이동시간 등록 실패:", err);
            alert("이동시간 등록 중 오류 발생");
        } finally {
            setIsLoadingRoute(false);
        }
    };


    const handleAddPlace = async () => {
        if (!newPlace.name || !newPlace.address) {
            alert("장소 이름과 주소를 모두 입력해주세요.");
            return;
        }

        try {
            const { lat, lng } = await getCoordinatesFromAddress(newPlace.address);

            // 👉 전역 함수 호출로 타임테이블에 등록
            if (window.registerToTimetable) {
                window.registerToTimetable(lat, lng, newPlace.name, newPlace.address);
            }

            // 입력값 초기화
            setNewPlace({ name: "", address: "", category: "음식점" });
            setModal(null);

        } catch (error) {
            console.error("좌표 변환 실패:", error);
            alert("주소를 좌표로 변환하는 데 실패했습니다.");
        }
    };

    const handleItemClick = async (i) => {
        if (activeMode !== "delete") return;

        const arr = [...schedule[selectedDay]];
        const place = arr[i];
        if (!place || !place.id) return;

        const confirmed = window.confirm("이 장소를 삭제하시겠습니까?");
        if (!confirmed) return;

        const prevPlace = i > 0 ? arr[i - 1] : null;
        const nextPlace = arr[i + 1] || null;

        try {
            // 1. 앞 이동시간 삭제
            if (prevPlace?.moveTimeId) {
                await axios.delete(`http://localhost:8080/movetime/${prevPlace.moveTimeId}`);
                prevPlace.moveTimeId = null;
                prevPlace.travelTime = null;
                prevPlace.type = null;
                prevPlace.placeUrl = null;
                console.log("앞 이동시간 삭제 완료");
            }

            // 2. 뒤 이동시간 삭제
            if (place.moveTimeId) {
                await axios.delete(`http://localhost:8080/movetime/${place.moveTimeId}`);
                console.log("뒤 이동시간 삭제 완료");
            }

            // 3. 앞 장소의 next_place_id 갱신
            if (prevPlace) {
                const payload = {
                    place_id: parseInt(prevPlace.id),
                    place_name: prevPlace.name,
                    place_address: prevPlace.address,
                    place_image: prevPlace.image,
                    place_business_hour: prevPlace.businessHour,
                    place_holiday: prevPlace.holiday,
                    place_stay_time: prevPlace.stayTime,
                    next_place_id: nextPlace ? parseInt(nextPlace.id) : null,
                    place_visiting_time: prevPlace.time && prevPlace.time !== "미정" ? `${prevPlace.time}:00` : "00:00:00",
                    latitude: prevPlace.latitude,
                    longitude: prevPlace.longitude,
                    travelId: prevPlace.travelId,
                    selected_day: prevPlace.selectedDay,
                    mongo: prevPlace.mongo
                };

                await axios.put(`http://localhost:8080/place/${prevPlace.id}`, payload);
                console.log("next_place_id 갱신 완료");
            }

            // 4. 장소 삭제
            await axios.delete(`http://localhost:8080/place/${place.id}`);
            console.log("장소 삭제 완료");

            // 5. 프론트 상태에서 제거
            arr.splice(i, 1);
            setSchedule(prev => ({ ...prev, [selectedDay]: arr }));

        } catch (err) {
            console.error("장소 삭제 처리 중 오류:", err);
            alert("삭제 중 오류가 발생했습니다.");
        }
    };


    // 시간 삭제
    const handleTimeDelete = async (e, i) => {
        e.stopPropagation();
        const arr = [...schedule[selectedDay]];
        const place = arr[i];

        if (!place || !place.id) return;

        const confirmed = window.confirm("시간을 삭제하시겠습니까?");
        if (!confirmed) return;

        try {
            await axios.delete(`http://localhost:8080/place/${place.id}/visiting-time`);
            arr[i].time = null;
            setSchedule(prev => ({ ...prev, [selectedDay]: arr }));
            console.log("방문시간 삭제 완료");
        } catch (err) {
            console.error("방문시간 삭제 실패", err);
            alert("방문시간 삭제 중 오류가 발생했습니다.");
        }
    };

    const handleAddMemo = () => {
        const arr = [...schedule[selectedDay]];
        const target = arr[selectedIndex];
        if (!target) return;

        let targetGroup;
        if (isAddingToExisting && targetMemoTitle) {
            targetGroup = target.memos.find(m => m.title === targetMemoTitle);
        } else {
            if (!memoTitle) return;
            targetGroup = { title: memoTitle, contents: [] };
            target.memos.push(targetGroup);
        }

        const sendToServer = () => {
            const formData = new FormData();

            // JSON 데이터
            const memoData = {
                memoTitle: memoTitle || targetMemoTitle || null,
                memoText: textContent || null,
                memoExtraLink: linkContent || null
            };

            formData.append("memo", new Blob([JSON.stringify(memoData)], { type: "application/json" }));

            // 이미지 파일 추가
            if (imageFile) {
                formData.append("image", imageFile);
            }
            //변경해야할 부분
            axios.post(`http://localhost:8080/memos/place/${target.id}/memo`, formData, {
                headers: { "Content-Type": "multipart/form-data" }
            })
                .then(() => {
                    console.log("메모 저장 성공");
                })
                .catch(err => {
                    console.error("메모 저장 실패", err);
                });
        };



        if (textContent) targetGroup.contents.push({ type: "text", content: textContent });
        if (linkContent) targetGroup.contents.push({ type: "link", content: linkContent });

        if (imageFile) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const imageData = reader.result;
                targetGroup.contents.push({ type: "image", content: imageData });

                sendToServer(imageData);

                setSchedule(prev => ({ ...prev, [selectedDay]: arr }));
                resetMemoInput();
            };
            reader.readAsDataURL(imageFile); // base64
            return;
        }

        sendToServer();
        setSchedule(prev => ({ ...prev, [selectedDay]: arr }));
        resetMemoInput();
    };

    const getCoordinatesFromAddress = (address) => {
        return new Promise((resolve, reject) => {
            naver.maps.Service.geocode({ query: address }, function (status, response) {
                if (status !== naver.maps.Service.Status.OK) {
                    reject("주소 검색 실패");
                    return;
                }

                const result = response.v2.addresses[0];
                const lat = parseFloat(result.y);
                const lng = parseFloat(result.x);
                resolve({ lat, lng });
            });
        });
    };

    const handleAddMoveTime = (index) => {
        setVisibleTransportIndex(index - 1); // 인덱스 기준으로 삽입 위치 맞춰줌
    };

    const resetMemoInput = () => {
        setMemoTitle("");
        setTextContent("");
        setLinkContent("");
        setImageFile(null);
        setTargetMemoTitle("");
        setIsAddingToExisting(false);
        setModal(null);
    };
    // 편집 대상 선택
    const handleSelectForEdit = i => {
        setSelectedEditIndex(i);
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const fromIndex = schedule[selectedDay].findIndex(item => item.id === active.id);
        const toIndex = schedule[selectedDay].findIndex(item => item.id === over.id);

        if (fromIndex !== -1 && toIndex !== -1) {
            handleMoveByIndex(fromIndex, toIndex);
        }
    };
    const handleMoveByIndex = async (fromIndex, toIndex) => {
        const arr = [...schedule[selectedDay]];

        const before = arr[fromIndex - 1];
        const current = arr[fromIndex];

        if (before?.moveTimeId) {
            try {
                await axios.delete(`http://localhost:8080/movetime/${before.moveTimeId}`);
                before.moveTimeId = null;
                before.travelTime = null;
                before.type = null;
                before.placeUrl = null;
            } catch (err) {
                console.warn("이전 이동시간 삭제 실패", err);
            }
        }

        if (current?.moveTimeId) {
            try {
                await axios.delete(`http://localhost:8080/movetime/${current.moveTimeId}`);
                current.moveTimeId = null;
                current.travelTime = null;
                current.type = null;
                current.placeUrl = null;
            } catch (err) {
                console.warn("현재 이동시간 삭제 실패", err);
            }
        }

        // 실제 순서 변경
        const itm = arr.splice(fromIndex, 1)[0];
        const newIdx = fromIndex < toIndex ? toIndex - 1 : toIndex;
        arr.splice(newIdx, 0, itm);

        // 🔁 next_place_id 갱신
        for (let i = 0; i < arr.length; i++) {
            const current = arr[i];
            const next = arr[i + 1];

            const payload = {
                place_id: parseInt(current.id),
                place_name: current.name,
                place_address: current.address,
                place_image: current.image,
                place_business_hour: current.businessHour,
                place_holiday: current.holiday,
                place_stay_time: current.stayTime,
                next_place_id: next ? parseInt(next.id) : null,
                place_visiting_time: current.time && current.time !== "미정" ? `${current.time}:00` : "00:00:00",
                latitude: current.latitude,
                longitude: current.longitude,
                travelId: current.travelId,
                selected_day: current.selectedDay,
                mongo: current.mongo
            };

            try {
                await axios.put(`http://localhost:8080/place/${current.id}`, payload);
            } catch (err) {
                console.error("순서 저장 실패:", err.response?.data || err);
            }
        }

        window.dispatchEvent(new CustomEvent("refresh-map-route", {
            detail: { day: selectedDay }
        }));
    };
    return (
        <div className={styles.wrapper}>
            <div className={styles.topBar}>
                <span className={styles.logo} onClick={() => navigate("/")}>TravelMate</span>

                <div className={styles.textMenuBar}>
                    <span className={styles.textMenuItem}
                          onClick={() => {
                              if (!(activeMode === "weather")) {
                                  setActiveMode("weather")
                                  navigate(`/timetable/${travelId}/weather`, {
                                      state: { period , backgroundLocation: location }}
                                  );
                              } else {
                                  setActiveMode(null)
                                  navigate(`/timetable/${travelId}`, {
                                      state: { period}});
                              }
                          }
                          }>⛅날씨</span>
                    {/*onClick={() => setShowPlaceList(true)*/}
                    <span className={styles.textMenuItem} onClick={() => {
                        if (!(activeMode === "tempList")) {
                            setActiveMode("tempList")
                            navigate(`/timetable/${travelId}/tempList`, {state: { period, backgroundLocation: location}})
                        } else {
                            setActiveMode(null)
                            navigate(`/timetable/${travelId}`, {
                                state: { period}});
                        }
                    }}>등록한 장소 보기</span>
                    <span className={styles.textMenuItem} onClick={() => setShowRegisterForm(true)}>장소 등록하기</span>
                    <span className={styles.textMenuItem} onClick={() => navigate("/mypage")}>마이페이지</span>
                </div>
            </div>
            {showRegisterForm && (
                <Modal  onClose={() => setShowRegisterForm(false)}>
                    <PlaceRegister onClose={() => setShowRegisterForm(false)} />
                </Modal>
            )}
            <div className={styles.content}>
                <div className={styles.timelinePanel}>
                    <div className={styles.headerRow}>
                        <div className={styles.dayNavigation}>
                            {/* 왼쪽 화살표 (항상 표시) */}
                            <button
                                className={`${styles.arrowButton} ${dayPageIndex === 0 ? styles.disabled : ""}`}
                                onClick={() => {
                                    if (dayPageIndex > 0) setDayPageIndex(prev => prev - 1);
                                }}
                                disabled={dayPageIndex === 0}
                            >
                                ◀
                            </button>

                            {/* Day 버튼들 (페이지별로 슬라이스) */}
                            {Array.from({length: period}, (_, i) => i + 1)
                                .slice(dayPageIndex * daysPerPage, (dayPageIndex + 1) * daysPerPage)
                                .map(day => (
                                    <button
                                        key={day}
                                        className={selectedDay === day ? styles.activeTab : styles.tab}
                                        onClick={() => {
                                            setSelectedDay(day); // 기존 상태 갱신
                                            sessionStorage.setItem("selectedDay", day);
                                        }}

                                    >
                                        Day {day}
                                    </button>
                                ))}

                            {/* 오른쪽 화살표 (항상 표시) */}
                            <button
                                className={`${styles.arrowButton} ${(dayPageIndex + 1) * daysPerPage >= period ? styles.disabled : ""}`}
                                onClick={() => {
                                    if ((dayPageIndex + 1) * daysPerPage < period) {
                                        setDayPageIndex(prev => prev + 1);
                                    }
                                }}
                                disabled={(dayPageIndex + 1) * daysPerPage >= period}
                            >
                                ▶
                            </button>
                        </div>


                        <div>
                            <button
                                className={styles.editDeleteButton}
                                onClick={() => {
                                    if (activeMode === "edit") {
                                        setActiveMode(null);
                                    } else {
                                        setActiveMode("edit");
                                    }
                                    setSelectedEditIndex(null);
                                }}
                            >편집
                            </button>
                            <button
                                className={`${styles.editDeleteButton} ${activeMode === "delete" ? styles.deleteModeItemButton : ""}`}
                                onClick={() => {
                                    if (activeMode === "delete") {
                                        setActiveMode(null);
                                    } else {
                                        setActiveMode("delete");
                                    }
                                }}
                            >삭제
                            </button>
                            <button className={styles.editDeleteButton} onClick={() => {
                                if(activeMode === "time"){
                                    setActiveMode(null);
                                }else{
                                    setActiveMode("time")
                                }
                            }
                            }
                            >시간 추가
                            </button>
                        </div>
                    </div>

                    <div className={styles.tripList}>
                        {activeMode === "edit" ? (
                            <DraggableSchedule
                                schedule={schedule}
                                selectedDay={selectedDay}
                                activeMode={activeMode}
                                onItemClick={handleSelectForEdit}
                                selectedEditIndex={selectedEditIndex}
                                onMemoAdd={(idx) => {
                                    setSelectedIndex(idx);
                                    setModal("memo");
                                }}
                                handleDragEnd={handleDragEnd}
                                visibleTransportIndex={visibleTransportIndex}
                                handleSelectTransport={handleSelectTransport}
                            />
                        ) : (
                            <>
                                {Array.isArray(schedule[selectedDay]) ? (
                                    schedule[selectedDay].map((item, idx) => (
                                        <React.Fragment key={item.id}>
                                            <div
                                                className={`${styles.scheduleItem} ${activeMode === "delete" ? styles.deleteModeItem : ""}`}
                                                onClick={() => {
                                                    if (activeMode === "delete") {
                                                        handleItemClick(idx); // 삭제 처리
                                                    } else if (activeMode === "edit") {
                                                        handleSelectForEdit(idx); // 순서 이동 선택
                                                    }

                                                }}
                                            >

                                                <div
                                                    className={styles.timeBox}
                                                    onClick={() => {
                                                        if (activeMode === "time") {
                                                            setSelectedIndex(idx);
                                                            setNewTime(item.time || "");
                                                            setModal("time");
                                                        }
                                                    }}
                                                    style={{cursor: activeMode === "time" ? "pointer" : "default"}}
                                                >
                                                    {item.time || "미정"}
                                                </div>

                                                <div className={styles.itemText}>
                                                    <img
                                                        src={item.image || defaultImage}
                                                        alt={`${item.name} 이미지`}
                                                        className={styles.itemImage}
                                                    />
                                                    <div>
                                                        <div
                                                            className={styles.itemTitle}
                                                            onClick={() => {
                                                                if (activeMode !== "delete") {
                                                                    const mongoId = schedule[selectedDay][idx].mongo;
                                                                    console.log("선택한 장소의 mongoId:", mongoId);
                                                                    if (!mongoId) {
                                                                        alert("상세 정보를 불러올 수 없는 장소입니다.");
                                                                        return;
                                                                    }

                                                                    navigate(`/place/${mongoId}`);
                                                                }
                                                            }}
                                                        >
                                                            {item.name}
                                                        </div>
                                                        <div className={styles.itemCategory}>{item.address}</div>
                                                    </div>

                                                    {item.memos?.length > 0 && (
                                                        <div
                                                            className={styles.memoBox}
                                                            onClick={() => toggleMemoPanel(idx)}
                                                        >
                                                            메모
                                                        </div>
                                                    )}
                                                </div>
                                                {(item.memos?.length ?? 0) === 0 && (
                                                    <button
                                                        className={styles.memoAddButton}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedIndex(idx);
                                                            setModal("memo");
                                                        }}
                                                    >
                                                        <span className={styles.plusIcon}>＋</span>
                                                    </button>
                                                )}
                                            </div>
                                            {idx < schedule[selectedDay].length - 1 && (
                                                <div className={styles.verticalConnectorWrapper}>
                                                    <div className={styles.verticalLine}/>
                                                    <button
                                                        className={`${styles.moveTimeButton} ${activeMode === "delete" ? styles.deleteModeItem : ""}`}
                                                        onClick={() => {
                                                            if (activeMode === "delete") {
                                                                handleMoveTimeDelete(idx);
                                                            } else {
                                                                const url = schedule[selectedDay]?.[idx]?.placeUrl;
                                                                if (url) {
                                                                    window.open(url, "_blank");
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        <div className={styles.labelRow}>
                                                            <label
                                                                className={styles.transferText}>{schedule[selectedDay]?.[idx]?.type || "type"}</label>
                                                            <label
                                                                className={styles.transferText}>{schedule[selectedDay]?.[idx]?.travelTime || "미정"}</label>
                                                        </div>
                                                    </button>
                                                </div>
                                            )}


                                        </React.Fragment>
                                    ))
                                ) : (
                                    <div className={styles.emptyMessage}>일정이 없습니다</div>
                                )}
                            </>
                        )}
                    </div>

                    {modal !== "place" && (
                        <div className={styles.guideToast} onClick={() => {
                            setModal("place");
                            setActiveMode(null);
                        }}>
                            ➕ 원하는 장소가 없다면 여기를 클릭하세요!
                        </div>
                    )}
                </div>

                {Array.isArray(schedule[selectedDay]) && schedule[selectedDay].some(item => item.showMemoPanel) && (
                    <div className={styles.memoPanel}>
                        <div className={styles.memoPanelHeader}>
                            <h3>메모</h3>
                            <div>
                                <button onClick={() => {
                                    setIsAddingToExisting(true);
                                    setModal("memo");
                                }}>수정
                                </button>
                                <button onClick={closeMemoPanel}>닫기</button>
                            </div>
                        </div>

                        {(schedule[selectedDay].find(item => item.showMemoPanel)?.memos || []).map((memoGroup, idx) => (
                            <div key={idx} className={styles.memoGroup}>
                                <h4>{memoGroup.title}</h4>
                                <ul>
                                    {["image", "link", "text"].map(type =>
                                        (Array.isArray(memoGroup.contents) ? memoGroup.contents : [])
                                            .filter(c => c.type === type)
                                            .map((c, i) => (
                                                <li key={`${type}-${i}`} className={styles.memoItem}>
                                                    {type === "image" ? (
                                                        <img src={c.content} alt="memo" className={styles.memoImage}/>
                                                    ) : (
                                                        <span style={{whiteSpace: "pre-wrap"}}>{c.content}</span>
                                                    )}
                                                </li>
                                            ))
                                    )}
                                </ul>
                            </div>
                        ))}
                    </div>
                )}

                <div className={styles.mapPanel}>
                    <Map selectedDay={selectedDay}/>
                </div>
            </div>

            {modal === "place" && (
                <Modal title="장소 추가" onClose={() => setModal(null)}>
                    <input
                        value={newPlace.name}
                        onChange={e => setNewPlace({...newPlace, name: e.target.value})}
                        placeholder="장소 이름"
                    />
                    <input
                        value={newPlace.address || ""}
                        onChange={e => setNewPlace({...newPlace, address: e.target.value})}
                        placeholder="주소"
                    />
                    <select
                        value={newPlace.category}
                        onChange={e => setNewPlace({...newPlace, category: e.target.value})}
                    >
                        <option>음식점</option>
                        <option>관광지</option>
                        <option>숙소</option>
                    </select>
                    <button onClick={handleAddPlace}>추가</button>
                </Modal>
            )}
            {modal === "memo" && (
                <Modal title={isAddingToExisting ? "메모 내용 추가" : "메모 입력"} onClose={() => setModal(null)}>
                    {!isAddingToExisting && (
                        <input placeholder="메모 제목" value={memoTitle} onChange={e => setMemoTitle(e.target.value)}/>
                    )}
                    {isAddingToExisting && (
                        <select value={targetMemoTitle} onChange={e => setTargetMemoTitle(e.target.value)}>
                            <option value="">제목 선택</option>
                            {(schedule[selectedDay][selectedIndex]?.memos || []).map((m, i) => (
                                <option key={i} value={m.title}>{m.title}</option>
                            ))}
                        </select>
                    )}
                    <textarea placeholder="텍스트 메모" rows={3} value={textContent}
                              onChange={e => setTextContent(e.target.value)}/>
                    <input placeholder="링크 메모" value={linkContent} onChange={e => setLinkContent(e.target.value)}/>
                    <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files[0])}/>
                    <button onClick={handleAddMemo}>저장</button>
                </Modal>
            )}
            {/* Edit Help Modal.js */}
            {modal === "editHelp" && (
                <div className={`${styles.modalOverlay} ${styles.editHelpOverlay}`}>
                    <div className={`${styles.modal} ${styles.editHelpModal}`}>
                        <h3 className={styles.editHelpTitle}>편집 모드 안내</h3>
                        <p className={styles.editHelpText}>
                            1. 이동할 일정을 클릭하여 선택합니다.<br/>
                            2. 일정 사이의 선을 클릭하여 새 위치를 지정합니다.<br/>
                            3. 이동된 일정은 시간만 초기화됩니다.
                        </p>
                        <div className={styles.checkboxContainer}>
                            <input
                                type="checkbox"
                                id="dontShowAgain"
                                checked={dontShowAgain}
                                onChange={e => setDontShowAgain(e.target.checked)}
                            />
                            <span className={styles.checkboxText}>다음에 표시하지 않기</span>
                        </div>
                        <button onClick={closeEditHelp} className={styles.modalButton}>
                            확인
                        </button>
                    </div>
                </div>
            )}
            {modal === "time" && (
                <Modal title="방문 시간 설정" onClose={() => setModal(null)}>
                    <input
                        type="time"
                        value={newTime}
                        onChange={(e) => setNewTime(e.target.value)}
                    />
                    <button
                        onClick={async () => {
                            await handleSaveTime(selectedIndex, newTime);
                            setModal(null);
                            setNewTime("");
                        }}
                    >
                        저장
                    </button>
                    <button
                        onClick={(e) => {
                            handleTimeDelete(e, selectedIndex);
                            setModal(null);
                            setNewTime("");
                        }}
                        style={{backgroundColor: "red", color: "white", marginLeft: "10px"}}
                    >
                        삭제
                    </button>
                </Modal>
            )}
            {isLoadingRoute && (
                <div className={styles.loadingOverlay}>
                    <div className={styles.loadingSpinner}>이동시간을 가져오는 중입니다...💨💨</div>
                </div>
            )}
        </div>
    );
};

const Modal = ({title, children, onClose}) => (
    <div className={styles.modalOverlay}>
        <div className={styles.modal}>
            <h3>{title}</h3>
            {children}
            <button onClick={onClose} className={styles.modalClose}>닫기</button>
        </div>
    </div>
);

export default Timetable;

//편집 모드 드래그앤드랍

const SortableScheduleItem = ({ item, index, onClick, isSelected, onMemoAdd }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isSelected ? 1000 : undefined,
    };

    return (
        <div
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            style={style}
            className={`${styles.scheduleItem} ${isSelected ? styles.selectedItem : ""}`}
            onClick={onClick}
        >
            <div className={styles.timeBox}>{item.time || "미정"}</div>
            <div className={styles.itemText}>
                <div className={styles.itemTitle}>{item.name}</div>
                <div className={styles.itemCategory}>{item.category}</div>
            </div>
            <button className={styles.memoAddButton} onClick={onMemoAdd}>
                <span className={styles.plusIcon}>＋</span>
            </button>
        </div>
    );
};

const DraggableSchedule = ({
                               schedule,
                               selectedDay,
                               activeMode,
                               onItemClick,
                               selectedEditIndex,
                               onMemoAdd,
                               handleDragEnd,
                               handleSelectTransport
                           }) => {
    const sensors = useSensors(useSensor(PointerSensor));

    if (activeMode !== "edit") return null;

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
                items={schedule[selectedDay].map((item) => item.id)}
                strategy={verticalListSortingStrategy}
            >
                {schedule[selectedDay].map((item, idx) => (
                    <React.Fragment key={item.id}>
                        <SortableScheduleItem
                            item={item}
                            index={idx}
                            onClick={() => onItemClick(idx)}
                            isSelected={selectedEditIndex === idx}
                            onMemoAdd={(e) => {
                                e.stopPropagation();
                                onMemoAdd(idx);
                            }}
                        />

                        {idx < schedule[selectedDay].length - 1 && (
                            <div className={styles.transportOptionsInline}>
                                <button className={styles.moveTimeButton} onClick={() => handleSelectTransport("🚗 자동차", idx)}>🚗 자동차</button>
                                <button className={styles.moveTimeButton} onClick={() => handleSelectTransport("🚶 도보", idx)}>🚶 도보</button>
                                <button className={styles.moveTimeButton} onClick={() => handleSelectTransport("🚌 대중교통", idx)}>🚌 대중교통</button>
                            </div>
                        )}
                    </React.Fragment>
                ))}
            </SortableContext>
        </DndContext>
    );
};
