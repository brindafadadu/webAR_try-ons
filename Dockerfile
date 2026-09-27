FROM node:18-slim

# Install Python and pip for rembg
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Install rembg globally
RUN pip3 install --break-system-packages rembg[cpu]

WORKDIR /app

# Copy package files and install Node dependencies
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy the rest of the app
COPY . .

# Expose the port
EXPOSE 3000

# Start the server
CMD ["node", "jewlry-app/backend/server.js"]
