import axios from "axios";

// 상세정보 id(mongo)가 없는 장소를 좌표·이름으로 식당 DB에서 찾아 id를 돌려준다.
// 못 찾으면 null.
const CATEGORIES = ["restaurant", "cafe"];
const normalize = (s = "") => s.replace(/\s+/g, "").toLowerCase();

export const findRestaurantId = async ({ name, lat, lon }) => {
    if (lat == null || lon == null) return null;
    const target = normalize(name);

    for (const category of CATEGORIES) {
        try {
            const res = await axios.get("/restaurant/category", {
                params: { category, lat, lon, limit: 30, distanceKm: 0.3 },
            });
            const list = res.data || [];
            // 1순위: 좌표가 거의 같은 곳, 2순위: 이름이 같은 곳
            const byCoord = list.find(r =>
                Math.abs(r.lat - lat) < 0.0003 && Math.abs(r.lon - lon) < 0.0003
            );
            const byName = target && list.find(r => normalize(r.title) === target);
            const found = byCoord || byName;
            if (found?.id) return found.id;
        } catch (err) {
            console.warn("식당 id 찾기 실패:", category, err);
        }
    }
    return null;
};
