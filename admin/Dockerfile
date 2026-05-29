# Use Node.js 20 base image
FROM node:20-alpine

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Expose port 4201
EXPOSE 4201

# Start Angular development server
CMD ["npx", "ng", "serve", "--host", "0.0.0.0", "--port", "4201", "--disable-host-check"]
