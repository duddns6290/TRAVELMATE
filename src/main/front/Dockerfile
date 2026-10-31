# 1) React 빌드
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY public ./public
COPY src ./src
COPY postcss.config.js ./

# CRA는 빌드 시점에 값이 박힌다. 비워 두면 같은 출처 상대 경로(Nginx 프록시)를 쓴다.
ARG REACT_APP_API_BASE=""
ENV REACT_APP_API_BASE=$REACT_APP_API_BASE
RUN npm run build

# 2) Nginx로 정적 파일 제공 + 백엔드 프록시
FROM nginx:1.27-alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
