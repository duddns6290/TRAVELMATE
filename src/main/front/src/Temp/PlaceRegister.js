import React, { useState } from "react";
import axios from "axios";
import "./PlaceRegister.css";

const PlaceRegister = ({ onClose }) => {
    const [form, setForm] = useState({
        name: "",
        address: "",
        image: "",
        businessHour: "",
        holiday: ""
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async () => {
        const travelId = sessionStorage.getItem("selectedTravelId");
        if (!travelId) {
            alert("여행 ID가 없습니다.");
            return;
        }

        window.naver.maps.Service.geocode({
            query: form.address
        }, async (status, response) => {
            if (status !== window.naver.maps.Service.Status.OK) {
                alert("주소를 좌표로 변환할 수 없습니다.");
                return;
            }

            const { y: latitude, x: longitude } = response.v2.addresses[0];

            const payload = {
                ...form,
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
                travelId: Number(travelId)
            };

            try {
                await axios.post("/tempplace", payload, {
                    headers: {
                        "Content-Type": "application/json"
                    }
                });
                alert("임시 장소가 등록되었습니다.");
                onClose();
            } catch (err) {
                console.error("등록 실패", err);
                alert("등록 실패");
            }
        });
    };

    // PlaceRegister.jsx
    return (
        <div className="register-content">
            <h3>임시 장소 등록하기</h3>
            <input name="name" placeholder="이름" value={form.name} onChange={handleChange}/>
            <input name="address" placeholder="주소" value={form.address} onChange={handleChange}/>
            <input name="image" placeholder="이미지 URL" value={form.image} onChange={handleChange}/>
            <input name="businessHour" placeholder="영업시간" value={form.businessHour} onChange={handleChange}/>
            <input name="holiday" placeholder="휴무일" value={form.holiday} onChange={handleChange}/>

            <div className="button-group">
                <button onClick={handleSubmit}>등록</button>
                <button onClick={onClose}>취소</button>
            </div>
        </div>
    );

};

export default PlaceRegister;
