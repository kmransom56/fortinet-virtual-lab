FROM node:16-alpine

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Create directory for persistent data
RUN mkdir -p /app/data

# Expose port
EXPOSE 3002

# Set environment variables
ENV NODE_ENV=production \
    SIMULATION_MODE=realistic \
    LOG_LEVEL=info

# Start the application
CMD ["node", "server.js"]
