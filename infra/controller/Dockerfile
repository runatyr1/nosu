FROM node:22-alpine
WORKDIR /app
COPY infra/controller/server.mjs infra/controller/index.html ./
ENV NODE_ENV=production PORT=3401
EXPOSE 3401
HEALTHCHECK --interval=15s --timeout=3s CMD node -e "fetch('http://127.0.0.1:3401/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
