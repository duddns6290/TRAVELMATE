package org.capstone.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * ddl-auto=update는 새 컬럼은 추가하지만 기존 컬럼 크기는 늘리지 않는다.
 * move_time.url이 VARCHAR(255)로 이미 만들어져 있으면 긴 네이버 길찾기 URL 저장이 실패(Data truncation)하므로
 * 서버 시작 시 한 번 TEXT로 넓힌다. 이미 TEXT면 아무것도 하지 않는다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SchemaFixConfig implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        try {
            List<String> types = jdbcTemplate.queryForList(
                    "SELECT DATA_TYPE FROM information_schema.COLUMNS " +
                    "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'move_time' AND COLUMN_NAME = 'url'",
                    String.class);
            if (!types.isEmpty() && "varchar".equalsIgnoreCase(types.get(0))) {
                jdbcTemplate.execute("ALTER TABLE move_time MODIFY url TEXT");
                log.info("move_time.url 컬럼을 VARCHAR → TEXT로 변경했습니다.");
            }
        } catch (Exception e) {
            log.warn("move_time.url 컬럼 확인/변경 실패: {}", e.getMessage());
        }
    }
}
