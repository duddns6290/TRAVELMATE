package org.capstone.entity;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.DynamicUpdate;

@Entity
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@DynamicUpdate
@Table(name = "users") // 어느 테이블에 있는 내용인지
public class User {
    @Id
    //속성 이름이랑 맞추기
    private String userid;
    private String name;
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY) // 로그인 요청으로는 받되, 응답 JSON에는 절대 내보내지 않는다
    private String userpw;
    private String email;
    private String provider;


    // 사용자의 이름이나 이메일을 업데이트하는 메소드 - oauth
    public User update( String id, String name, String email) {
        this.name = name;
        this.email = email;
        this.userid =id;

        return this;
    }
}
