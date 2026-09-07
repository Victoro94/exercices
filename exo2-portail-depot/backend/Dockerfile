FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm run build && npm run build:seed

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# libssl pour le moteur Prisma sous musl
RUN apk add --no-cache openssl
COPY package.json package-lock.json* ./
# On garde les node_modules du build (prisma CLI inclus) :
# le runtime doit pouvoir faire `migrate deploy`.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-seed ./dist-seed
COPY --from=build /app/prisma ./prisma
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
