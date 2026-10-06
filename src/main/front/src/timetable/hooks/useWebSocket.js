// ✅ useTimetableSocket.js
import { useEffect, useRef } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

const useWebSocket = ({ travelId, onMessageReceive }) => {
    const clientRef = useRef(null);

    useEffect(() => {
        if (!travelId) return;

        const socket = new SockJS("http://localhost:8080/ws");
        const client = new Client({
            webSocketFactory: () => socket,
            reconnectDelay: 5000,
            onConnect: () => {
                client.subscribe(`/topic/${travelId}`, (msg) => {
                    const data = JSON.parse(msg.body);
                    onMessageReceive?.(data);
                });
            },
        });

        client.activate();
        clientRef.current = client;

        return () => {
            client.deactivate();
        };
    }, [travelId, onMessageReceive]);

    const sendMessage = (message) => {
        clientRef.current?.publish({
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

    return { sendMessage, sendLock, sendUnlock };
};

export default useWebSocket;
