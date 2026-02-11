import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

const OAuthCallback = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const queryParams = new URLSearchParams(window.location.search);
        const token = queryParams.get("accessToken");

        if (token) {
            localStorage.setItem("accessToken", token);
            console.log("✅ 저장된 토큰:", token);

            try {
                const decoded = jwtDecode(token);
                console.log("🧩 디코딩 결과:", decoded);

                if (decoded.sub) {
                    sessionStorage.setItem("userId", decoded.sub);
                    console.log("✅ 세션 저장 완료:", decoded.sub);
                }
            } catch (err) {
                console.error("❌ 디코딩 실패:", err);
            }

            navigate("/");
        } else {
            console.warn("❗ accessToken 없음");
        }
    }, [navigate]);

    return <div>로그인 처리 중입니다...</div>;
};

export default OAuthCallback;
