package org.capstone.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(name = "memo")
public class Memo {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int memoId;

    @Column(columnDefinition = "TEXT")
    private String memoText;
    private String memoTitle;
    private String memoImage;
    private String memoExtraLink;

    private Integer placeId;
    private Integer tempId;
}
