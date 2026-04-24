# Use a newer patched Node.js Alpine image
FROM node:22-alpine3.21

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Start the application
CMD ["node", "index.js"]
