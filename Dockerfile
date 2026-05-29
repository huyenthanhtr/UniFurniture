# Use a lightweight Node.js base image
FROM node:20-alpine

# Install build dependencies (sometimes required for native npm modules)
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# Copy package configurations first to leverage Docker's layer caching
COPY package.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/
COPY admin/package*.json ./admin/

# Install dependencies for all three services
RUN echo "=== Installing Server dependencies ===" && cd server && npm install
RUN echo "=== Installing Client dependencies ===" && cd client && npm install
RUN echo "=== Installing Admin dependencies ===" && cd admin && npm install

# Copy all application source code
COPY server ./server
COPY client ./client
COPY admin ./admin

# Install concurrently globally to run all services in parallel
RUN npm install -g concurrently

# Expose ports for each service:
# - 3000: Server API
# - 4200: Client App (Angular)
# - 4201: Admin App (Angular)
EXPOSE 3000 4200 4201

# Command to launch all 3 services concurrently
# We use --host 0.0.0.0 and --disable-host-check so Angular dev server is accessible from outside the container
CMD ["concurrently", \
     "\"cd server && node server.js\"", \
     "\"cd client && npx ng serve --host 0.0.0.0 --port 4200 --disable-host-check\"", \
     "\"cd admin && npx ng serve --host 0.0.0.0 --port 4201 --disable-host-check\""]
