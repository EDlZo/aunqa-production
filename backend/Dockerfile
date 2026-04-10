FROM node:20-slim

# Install Chromium + Thai fonts สำหรับ Puppeteer PDF generation
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-thai-tlwg \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps --omit=dev

COPY . .

# Non-root user for security
RUN groupadd --system nodejs && useradd --system --gid nodejs nodeuser
RUN chown -R nodeuser:nodejs /app
USER nodeuser

EXPOSE 5000

CMD ["node", "server-mongo.cjs"]
