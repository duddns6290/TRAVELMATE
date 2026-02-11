package org.capstone.entity.userTravel;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.Getter;

import java.io.Serializable;
import java.util.Objects;

@Getter
@Embeddable
public class TravelUserId implements Serializable {
    @Column(name = "travel_id")
    private int travelId;
    @Column(name = "userid")
    private String userId;

    // 기본 생성자
    public TravelUserId() {}

    public TravelUserId(int travelId, String userId) {
        this.travelId = travelId;
        this.userId = userId;
    }

    // equals(), hashCode() 반드시 오버라이드!
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof TravelUserId)) return false;
        TravelUserId that = (TravelUserId) o;
        return travelId == that.travelId &&
                Objects.equals(userId, that.userId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(travelId, userId);
    }

    public String getUserId() {
        return userId;
    }
}

