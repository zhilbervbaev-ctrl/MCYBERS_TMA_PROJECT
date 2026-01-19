# Use official Node.js LTS image
FROM node:20

# Create app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies (none in this case)
RUN npm install

# Copy the rest of the app
COPY . .

# Expose port the app runs on
EXPOSE 3000

# Command to run the app
CMD ["npm", "start"]
