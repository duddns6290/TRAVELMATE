import requests
from urllib.parse import quote
from datetime import datetime

# 출발지/도착지 정보
start_name = "국립금오공과대학교"
end_name = "구미역"
start_coord = (128.3935029, 36.1458743)
end_coord = (128.330825, 36.1282649)

# UTF-8 인코딩
encoded_start_name = quote(start_name)
encoded_end_name = quote(end_name)

# 현재 시각 (ISO 포맷)
departure_time = datetime.now().isoformat()

# 요청 URL
url = (
    f"https://map.naver.com/p/api/directions/car"
    f"?crs=EPSG:4326&rptype=4&respversion=4&output=json"
    f"&start={start_coord[0]},{start_coord[1]},placeid%3D0,name%3D{encoded_start_name}"
    f"&goal={end_coord[0]},{end_coord[1]},placeid%3D0,name%3D{encoded_end_name}"
    f"&cartype=1&fueltype=1&mileage=11.4"
    f"&mainoption=traoptimal,avoidhipassonly"
)

# 요청 헤더
headers = {
    "accept": "application/json, text/plain, */*",
    "referer": "https://map.naver.com/",
    "user-agent": "Mozilla/5.0",
}

# 요청
response = requests.get(url, headers=headers)

# 응답 처리
if response.status_code == 200:
    data = response.json()
    summary = data["routes"][0]["summary"]
    print("✅ 자동차 경로 정보:")
    print(f"총 거리: {summary['distance']}m")
    print(f"총 시간: {summary['duration'] // 60}분 {summary['duration'] % 60}초")
    print(f"통행료: {summary['tollFare']}원")
else:
    print(f"❌ 요청 실패: {response.status_code}")
