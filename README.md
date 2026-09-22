# RoboCampus / AI Campus

RoboCampus is a full-stack web app that blends a social campus experience, multiplayer game lab, and AI-powered learning roadmap generation. The project is split into a Node.js backend and a React + Vite frontend, with real-time multiplayer behavior powered by Socket.IO and AI features powered by LangChain and Google/OpenRouter-based model integrations.

## Overview

This project combines several ideas into a single experience:

- A user authentication and profile system
- A campus-style frontend with avatars and world navigation
- A multiplayer gaming lab with lobby creation, join flows, and live battle logic
- Real-time voice/video communication support
- AI-generated learning roadmaps based on user answers
- Resource suggestions from YouTube and Tavily

The app is designed as a browser-based educational campus with game mechanics layered on top of a learning platform.

## Tech stack

### Frontend
- React 19
- Vite
- Socket.IO client
- Framer Motion
- @xyflow/react for graph/roadmap visualization

### Backend
- Node.js
- Express.js
- MongoDB with Mongoose
- Redis for rate limiting
- Socket.IO for multiplayer and realtime updates
- JWT for authenticated API access
- LangChain + GenAI integrations for roadmap generation

## Project structure

```text
robulux/
├── README.md
├── ai-campus-backend/
│   ├── .env
│   ├── index.js
│   ├── socket.js
│   ├── package.json
│   ├── config/
│   │   └── redisClient.js
│   ├── data/
│   ├── lib/
│   │   ├── llmChain.js
│   │   ├── resourceFetcher.js
│   │   └── roadmapGraph.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── rateLimiter.js
│   ├── models/
│   │   ├── GameMatch.js
│   │   ├── RoadmapSession.js
│   │   └── User.js
│   └── routes/
│       ├── auth.js
│       ├── games.js
│       ├── profile.js
│       └── roadmap.js
└── ai-campus-frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    ├── README.md
    ├── public/
    └── src/
        ├── App.jsx
        ├── App.css
        ├── config.js
        ├── Login.jsx
        ├── CampusWorld.jsx
        ├── GamingLab.jsx
        ├── Battlefield.jsx
        ├── RoadmapLab.jsx
        ├── SummaryGrid.jsx
        ├── SummaryDetail.jsx
        ├── AvatarPicker.jsx
        ├── PlayerCharacter.jsx
        ├── Reception.jsx
        ├── Usevoicechat.js
        └── main.jsx
```

## Main features

### 1. Authentication and profile
- User signup/login with hashed passwords
- JWT-based authentication
- Profile data including avatar colors and progression stats
- Persistent game history and summary data

### 2. Campus and social world
- Campus map navigation
- Character avatar customization
- Player presence updates over Socket.IO
- Real-time movement and world state synchronization

### 3. Gaming Lab
- Create matches with name, duration, and max players
- Join and watch lobby states
- Start battles when the creator begins a match
- Real-time combat with hit detection, movement, and leaderboard tracking

### 4. Roadmap Lab
- User provides a learning topic
- AI asks 4 follow-up questions
- Answers are converted into a personalized learning roadmap
- Roadmap is rendered as a graph of nodes and dependencies
- Video and article recommendations are fetched for each node

### 5. Voice/video communication
- Peer-to-peer signaling for voice and camera streams
- Audio/video toggle in the UI
- Real-time peer join/leave behavior

## Backend architecture

The backend runs as a single Express server that also hosts the Socket.IO server on the same port.

### Core backend components

- `index.js`: app bootstrap, middleware setup, route registration, MongoDB connection, Socket.IO initialization
- `routes/auth.js`: signup and login endpoints
- `routes/games.js`: lobby creation, join flow, game details
- `routes/profile.js`: current user, avatar updates, summary data
- `routes/roadmap.js`: roadmap generation sessions
- `socket.js`: multiplayer world loop, lobby logic, battle logic, voice signaling
- `models/*.js`: MongoDB schemas for users, game matches, and roadmap sessions

### AI roadmap flow

The roadmap route calls a LangChain-based graph pipeline:

1. Generate 4 follow-up questions based on the learning topic
2. Collect user answers
3. Build a roadmap graph using an LLM prompt
4. Validate and parse JSON output
5. Fetch related YouTube and article resources for roadmap nodes

## Frontend architecture

The frontend is a single-page app centered around `App.jsx`.

### Main UI areas
- Reception: main landing area and navigation hub
- Campus: movement and world map
- Gaming Lab: live matches and lobby actions
- Roadmap Lab: learning roadmap interaction
- Summary: user progress and game history

The frontend communicates with the backend via REST APIs and Socket.IO events.

## Prerequisites

Before running the project, make sure you have:

- Node.js 18+
- npm
- MongoDB running locally or available remotely
- Redis running locally or via managed hosting
- API keys for the AI/resource services used by the backend

## Setup

### 1. Install backend dependencies

```bash
cd ai-campus-backend
npm install
```

### 2. Install frontend dependencies

```bash
cd ../ai-campus-frontend
npm install
```

### 3. Configure environment variables

Create an `.env` file inside `ai-campus-backend` with the following values:

```env
MONGO_URI=mongodb://localhost:27017/aicampus
JWT_SECRET=your_super_secret_key
PORT=4000

OPENROUTER_API_KEY=your_key
GEMINI_API_KEY=your_key
GROK_API_KEY=your_key
MISTRAL_API_KEY=your_key

GEMINI_MODEL=gemini-3.6-flash
YOUTUBE_API_KEY=your_youtube_data_api_key
TAVILY_API_KEY=your_tavily_api_key
REDIS_URL=redis://localhost:6379
```

> The project also includes a `.env` file already in the backend folder in the current workspace, but you should replace default or placeholder values before using it in a real environment.

## Run the project

### Start the backend

```bash
cd ai-campus-backend
npm start
```

or in development mode:

```bash
cd ai-campus-backend
npm run dev
```

### Start the frontend

```bash
cd ai-campus-frontend
npm run dev
```

The frontend will usually run on a Vite dev server, defaulting to a local port such as 5173, while the API server runs on port 4000.

## API summary

### Auth
- `POST /auth/signup`
- `POST /auth/login`

### Profile
- `GET /profile/me`
- `PUT /profile/avatar`
- `GET /profile/me/games`
- `GET /profile/me/summary`
- `GET /profile/me/summary/games`

### Games
- `POST /games`
- `GET /games`
- `POST /games/:id/join`
- `GET /games/:id`

### Roadmap
- `POST /roadmap/start`
- `POST /roadmap/:id/answer`
- `GET /roadmap/:id`
- `GET /roadmap`

## Important notes

- The backend uses the same Node process for both Express REST routes and Socket.IO events.
- The frontend expects the backend on `http://localhost:4000` unless `VITE_API_URL` is set.
- The default `ai-campus-frontend/src/config.js` uses `VITE_API_URL` or localhost fallback.
- The app expects valid AI keys to be configured for roadmap generation and resource fetching.
- Redis is used for request rate limiting, so it should be available before starting the backend.

## Production / deployment considerations

This project is structured for local development but can be adapted for deployment with:

- a hosted MongoDB instance
- a hosted Redis instance
- environment variables injected securely in deployment
- a production build for the frontend
- reverse proxy / Nginx configuration if needed

## License

This project currently does not declare a formal license in its package metadata. If this project is intended for public distribution, add an explicit license file and metadata before publishing.

## Suggested next steps

- Add automated tests for backend routes and game logic
- Split environment configuration into `.env.example`
- Add CI/CD checks for linting and build validation
- Add Docker setup for MongoDB, Redis, backend, and frontend
- Harden API validation and error handling for production use

## Summary

RoboCampus is a real-time, AI-enhanced campus simulation and learning platform. It combines social presence, game mechanics, and personalized educational roadmaps into a single cohesive web app. The project is best run with MongoDB, Redis, and valid API keys configured in the backend environment.
