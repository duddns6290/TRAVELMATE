// src/hooks/useTimetableSocket.js
import { useEffect, useRef } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

const useTimetableSocket = ({ travelId, onMessage }) => {
    const clientRef = useRef(null);

    useEffect(() => {
        if (!travelId) return;

        const socket = new SockJS("/ws");
        const client = new Client({
            webSocketFactory: () => socket,
            reconnectDelay: 5000,
            onConnect: () => {
                client.subscribe(`/topic/traveluser/${travelId}`, (msg) => {
                    const event = JSON.parse(msg.body);
                    onMessage(event);  // 콜백으로 전달
                });
            },
        });

        client.activate();
        clientRef.current = client;

        return () => {
            client.deactivate();
        };
    }, [travelId, onMessage]);

    const send = (event) => {
        clientRef.current?.publish({
            destination: `/app/traveluser/update/${event.travelId}`,
            body: JSON.stringify(event),
        });
    };

    return { send };
};

export default useTimetableSocket;
