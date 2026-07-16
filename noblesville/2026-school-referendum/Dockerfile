FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
USER node
# App Runner (Fargate) overrides the HOSTNAME env var with the container's
# internal hostname at runtime, which makes Next.js standalone bind to that
# hostname instead of 0.0.0.0 and fail App Runner's loopback health check.
# Force the bind address at process level so runtime injection can't break it.
CMD ["sh", "-c", "HOSTNAME=0.0.0.0 node server.js"]
