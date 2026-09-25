# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
COPY apps/armada/package.json apps/armada/package-lock.json ./
RUN npm ci
COPY apps/armada/ ./
ARG VITE_BASE_PATH=/groups-app/
ARG VITE_PUBLIC_WEB_ORIGIN
ARG VITE_NOSU_PARENT_ORIGIN
ARG VITE_CONCORD_AV_SERVERS=
RUN npm run build

FROM nginx:1.27-alpine
COPY infra/groups-nginx.conf /etc/nginx/conf.d/default.conf
COPY infra/privacy-guard.sh /docker-entrypoint.d/05-nosu-privacy-guard.sh
RUN chmod +x /docker-entrypoint.d/05-nosu-privacy-guard.sh
COPY --from=build /app/dist/ /usr/share/nginx/html/
EXPOSE 80
