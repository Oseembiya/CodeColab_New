# CodeColab

A real-time collaborative coding platform with integrated whiteboard and video chat features.

## Features

- Real-time collaborative code editor
- Interactive whiteboard
- Video/audio communication
- User authentication
- Session management

## Project Structure

```
codecolab/
├── frontend/           # React frontend application
│   ├── src/
│   │   ├── components/ # UI components
│   │   ├── contexts/   # React context providers
│   │   ├── pages/      # Page components
│   │   ├── services/   # API services
│   │   ├── styles/     # CSS styles
│   │   └── App.jsx     # Main application component
│   └── index.html      # HTML entry point
├── backend/            # Node.js backend
│   ├── src/
│   │   ├── routes/     # API routes
│   │   ├── socket/     # Socket.IO handlers
│   │   ├── config/     # Configuration
│   │   ├── middleware/ # Express middleware
│   │   └── index.js    # Server entry point
└── README.md           # Project documentation
```

## Setup Instructions

### Backend Setup

```bash
cd backend
npm install
# Create a .env file based on .env.example
npm run dev
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

## Technologies Used

- **Frontend**: React, Socket.IO Client, Monaco Editor, Fabric.js, PeerJS
- **Backend**: Node.js, Express, Socket.IO, Firebase Admin
- **Database**: Firebase Firestore

## Development

The application is in development mode. Both servers support hot reloading for a smooth development experience.
