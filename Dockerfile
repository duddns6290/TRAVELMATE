# 1. Gradle 빌드 환경
FROM eclipse-temurin:17-jdk AS build

WORKDIR /app

COPY gradlew build.gradle settings.gradle ./
COPY gradle ./gradle
COPY src ./src

RUN chmod +x ./gradlew

RUN ./gradlew bootJar --no-daemon

# 2. Spring Boot 실행 환경
FROM eclipse-temurin:17-jre

WORKDIR /app

COPY --from=build /app/build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
