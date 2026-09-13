// 📁 src/utils/sortPlaces.js

/**
 * nextPlaceId 기준으로 장소 순서를 재정렬합니다.
 * @param {Array} places
 * @returns {Array} 정렬된 장소 배열
 */
export const sortPlacesByNextPlaceId = (places) => {
    if (!places || places.length === 0) return [];

    const idToPlaceMap = {};
    const nextIdSet = new Set();

    places.forEach(place => {
        idToPlaceMap[place.id] = place;
        if (place.nextPlaceId !== null) {
            nextIdSet.add(place.nextPlaceId.toString());
        }
    });

    const start = places.find(p => !nextIdSet.has(p.id.toString()));
    if (!start) return places;

    const result = [];
    let current = start;
    while (current) {
        result.push(current);
        const nextId = current.nextPlaceId;
        current = nextId ? idToPlaceMap[nextId.toString()] : null;
    }

    return result;
};
