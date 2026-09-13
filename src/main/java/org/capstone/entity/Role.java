package org.capstone.entity;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum Role {
    GUEST_READ("GUEST_READ"),
    GUEST_WRITE("GUEST_WRITE"),
    HOST("HOST");

    private final String key;
}