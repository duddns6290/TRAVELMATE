package org.capstone.entity;

import lombok.Data;
import lombok.Getter;

@Getter
@Data
public class WebSocketMessage {
    private String type; //PLACE_LOCK, PLACE_UNLOCK, PLACE_UPDATE
    private int travelId;
    private int placeId;
    private String userId;
    private Object newValue;
    private long timestamp;
}
