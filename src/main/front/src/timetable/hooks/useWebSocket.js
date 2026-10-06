// ✅ useTimetableSocket.js
import { useEffect, useRef } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

const useWebSocket = ({ travelId, onMessageReceive, onCursorReceive }) => {
    const clientRef = useRef(null);
    // 콜백은 렌더마다 새로 만들어지므로 ref로 최신값만 참조한다. (deps에 넣으면 렌더마다 소켓이 재연결되어 메시지가 유실됨)
    const onMessageRef = useRef(onMessageReceive);
    onMessageRef.current = onMessageReceive;
    const onCursorRef = useRef(onCursorReceive);
    onCursorRef.current = onCursorReceive;

    useEffect(() => {
        if (!travelId) return;

        const client = new Client({
            // 재연결 시마다 새 소켓이 필요하므로 팩토리 안에서 생성
            webSocketFactory: () => new SockJS("http://localhost:8080/ws"),
            reconnectDelay: 5000,
            onConnect: () => {
                client.subscribe(`/topic/${travelId}`, (msg) => {
                    const data = JSON.parse(msg.body);
                    onMessageRef.current?.(data);
                });
                // 실시간 커서 (편집 메시지와 별도 채널)
                client.subscribe(`/topic/${travelId}/cursor`, (msg) => {
                    onCursorRef.current?.(JSON.parse(msg.body));
                });
            },
        });

        client.activate();
        clientRef.current = client;

        return () => {
            client.deactivate();
        };
    }, [travelId]);

    const sendMessage = (message) => {
        if (!clientRef.current?.connected) {
            console.warn("웹소켓 미연결 상태라 메시지를 보내지 못했습니다:", message.type);
            return;
        }
        clientRef.current.publish({
            destination: `/app/update/${message.travelId}`,
            body: JSON.stringify(message),
        });
    };
    const sendLock = ({ placeId, userId }) => {
        sendMessage({
            type: "PLACE_LOCK",
            travelId,
            placeId,
            userId,
            timestamp: Date.now()
        });
    };

    const sendUnlock = ({ placeId, userId }) => {
        sendMessage({
            type: "PLACE_UNLOCK",
            travelId,
            placeId,
            userId
        });
    };

    // 커서 전송은 자주 일어나므로 미연결이면 조용히 버린다
    const sendCursor = (payload) => {
        if (!clientRef.current?.connected) return;
        clientRef.current.publish({
            destination: `/app/cursor/${travelId}`,
            body: JSON.stringify(payload),
        });
    };

    return { sendMessage, sendLock, sendUnlock, sendCursor };
};

export default useWebSocket;
