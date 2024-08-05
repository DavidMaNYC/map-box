# Mapbox

Overview This project is a React web application that integrates with Mapbox to provide mapping functionality, focused on the creation and manipulation of polygons. Users can add, edit, and delete polygons, with each session being uniquely identified. The application also features unit tests and a backend built with Node.js.

# Installation 

## Prerequisites 
-Node.js 
-npm

# Setup

## Install frontend dependencies:

    npm install

## Navigate to the server directory and install backend dependencies:

    cd server

    npm install

# Set up environment variables:

## Create a .env file in the root directory with the following variables: makefile

    VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_access_token
    VITE_API_URL=your_api_url

## Create a .env file in the server directory with the following variables: makefile

    PORT=5000 
    DATABASE_URL=your_database_url
    REDIS_HOST=your_redis_host
    REDIS_PORT=your_redis_port
    REDIS_PASSWORD=your_redis_password
    
# Start the application:

In the root directory, run the start script:

    npm run start

    Usage

Open your browser and navigate to http://localhost:5173.

Use the map to create, edit, and delete polygons. Share session-specific polygons using the generated link.

Running Tests

To run the unit tests for the backend:

    cd server

    npm test
