FROM oven/bun:1.3.14-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV HUSKY=0
ENV HOST=0.0.0.0
ENV PORT=3000

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production --ignore-scripts

COPY . .

EXPOSE 3000

CMD ["bun", "run", "start"]
