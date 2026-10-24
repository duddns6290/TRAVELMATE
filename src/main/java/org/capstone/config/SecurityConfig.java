package org.capstone.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.capstone.service.CustomOAuth2UserService;
import org.capstone.token.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Slf4j // 로그 사용
@RequiredArgsConstructor
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    private final CustomOAuth2UserService customOAuth2UserService;
    private final OAuth2SuccessHandler oAuth2SuccessHandler; // A
    private final TokenAuthenticationFilter tokenAuthenticationFilter; // B
    private final JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint;
    private final JwtAccessDeniedHandler jwtAccessDeniedHandler;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .headers(headers -> headers.frameOptions(frame -> frame.disable())) // h2-console 사용을 위해
                .exceptionHandling(exception -> exception
                        .authenticationEntryPoint(jwtAuthenticationEntryPoint)
                        .accessDeniedHandler(jwtAccessDeniedHandler)
                    ) // 예외
                .cors(Customizer.withDefaults()) // WebConfig의 CORS 설정을 시큐리티 필터에도 적용 (401/403 응답에도 CORS 헤더)
                .authorizeHttpRequests(auth -> auth
                        // 로그인 전에도 열어두는 것: 정적 리소스, 문서, OAuth 로그인 흐름, 웹소켓 핸드셰이크, 공개 데이터(날씨·가게 정보)
                        .requestMatchers("/", "/error", "/css/**", "/images/**", "/js/**", "/h2-console/**",
                                "/swagger-ui/**", "/v3/api-docs/**", "/swagger-resources/**", "/webjars/**",
                                "/oauth2/**", "/login/**", "/user/login", "/ws/**",
                                "/auth/refresh", "/auth/logout", // Access Token이 만료된 상태에서 부르므로 열어둔다 (쿠키로 검증)
                                "/api/weather/**", "/restaurant/**").permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/api/v1/**").hasRole("USER")
                        // 나머지는 JWT 필수. 여행별 권한은 컨트롤러의 @PreAuthorize(TravelAccessChecker)로 검사한다.
                        .anyRequest().authenticated()
                )
                .logout(logout -> {
                    logout.logoutSuccessUrl("/");
                })
                .oauth2Login(oauth2 -> oauth2
                    .userInfoEndpoint(userInfo -> userInfo.userService(customOAuth2UserService))
                        .successHandler(oAuth2SuccessHandler)
                )
                .addFilterBefore(tokenAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
//                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }


}
