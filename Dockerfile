# Use Node.js 20 Alpine for a small, secure footprint
FROM node:20-alpine

# Install build tools required for compiling sqlite3
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm install --production

# Copy application code
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose the application port
EXPOSE 3000

# Start the server
CMD ["node", "index.js"]
