# CodeColab Frontend

A modern, real-time collaborative coding platform built with React, featuring live code editing, video chat, interactive whiteboards, and code execution capabilities.

## 🚀 Features

### Core Collaboration

- **Real-time Code Editing**: Collaborative code editor with Monaco Editor
- **Live Video Chat**: Peer-to-peer video communication using PeerJS
- **Interactive Whiteboard**: Collaborative drawing and diagramming with Fabric.js
- **Session Management**: Create, join, and manage coding sessions
- **User Authentication**: Firebase-based authentication system

### Code Execution

- **Multi-language Support**: JavaScript, Python, Java, C++, C#
- **Real-time Output**: Execute code and see results instantly
- **Judge0 Integration**: Secure code execution via RapidAPI

### User Experience

- **Responsive Design**: Works seamlessly on desktop and mobile
- **Real-time Notifications**: Toast notifications for user feedback
- **Session Persistence**: Maintains session state across page refreshes
- **Performance Tracking**: Built-in metrics and analytics

## 🏗️ Architecture

### Tech Stack

- **Frontend Framework**: React 18 with Vite
- **State Management**: React Context API
- **Real-time Communication**: Socket.IO client
- **Code Editor**: Monaco Editor (VS Code's editor)
- **Video Chat**: PeerJS for WebRTC
- **Whiteboard**: Fabric.js for canvas manipulation
- **Authentication**: Firebase Auth
- **Styling**: CSS with component-based organization
- **Build Tool**: Vite for fast development and optimized builds

### Project Structure

```
frontend/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── layout/         # Layout components (Sidebar)
│   │   ├── Session/        # Session-specific components
│   │   └── VideoChat.jsx   # Video chat functionality
│   ├── contexts/           # React Context providers
│   │   ├── AuthContext.jsx     # Authentication state
│   │   ├── SessionContext.jsx  # Session management
│   │   ├── SocketContext.jsx   # WebSocket connections
│   │   └── UserMetricsContext.jsx # User analytics
│   ├── pages/              # Route components
│   │   ├── auth.jsx        # Authentication page
│   │   ├── dashboard.jsx   # Main dashboard
│   │   ├── session.jsx     # Code editing session
│   │   ├── whiteboard.jsx  # Collaborative whiteboard
│   │   └── ...            # Other pages
│   ├── services/           # External service integrations
│   │   └── firebase.js     # Firebase configuration
│   └── styles/             # CSS files organized by feature
├── public/                 # Static assets
└── package.json           # Dependencies and scripts
```

## 🛠️ Setup & Installation

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Backend server running (see backend README)

### Quick Start

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd CodeColab/frontend
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment Configuration**

   Create environment files for different environments:

   **Development** (`.env.development`):

   ```env
   VITE_API_URL=http://localhost:3001
   VITE_SOCKET_URL=http://localhost:3001
   VITE_FIREBASE_API_KEY=your_firebase_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_USE_EMULATORS=false
   VITE_ENABLE_DEBUG_LOGS=true
   ```

   **Production** (`.env.production`):

   ```env
   VITE_API_URL=https://your-backend-domain.com
   VITE_SOCKET_URL=https://your-backend-domain.com
   VITE_FIREBASE_API_KEY=your_firebase_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_USE_EMULATORS=false
   VITE_ENABLE_DEBUG_LOGS=false
   VITE_ENABLE_ANALYTICS=true
   ```

4. **Start development server**

   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:5173`

## 📜 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for development
- `npm run build:prod` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 🔧 Environment Variables

### Required Variables

- `VITE_API_URL` - Backend API endpoint
- `VITE_SOCKET_URL` - WebSocket server URL
- `VITE_FIREBASE_API_KEY` - Firebase API key
- `VITE_FIREBASE_AUTH_DOMAIN` - Firebase auth domain
- `VITE_FIREBASE_PROJECT_ID` - Firebase project ID
- `VITE_FIREBASE_STORAGE_BUCKET` - Firebase storage bucket
- `VITE_FIREBASE_MESSAGING_SENDER_ID` - Firebase messaging sender ID
- `VITE_FIREBASE_APP_ID` - Firebase app ID

### Optional Variables

- `VITE_USE_EMULATORS` - Use Firebase emulators (true/false)
- `VITE_ENABLE_DEBUG_LOGS` - Enable debug logging (true/false)
- `VITE_ENABLE_ANALYTICS` - Enable analytics tracking (true/false)
- `VITE_SENTRY_DSN` - Sentry error tracking DSN
- `VITE_APP_VERSION` - Application version
- `VITE_API_CACHE_TIME` - API cache duration in seconds
- `VITE_ENABLE_SERVICE_WORKER` - Enable PWA features (true/false)

## 🎯 Key Features Explained

### Real-time Code Collaboration

- Uses Monaco Editor with custom synchronization
- Real-time cursor tracking and selection sharing
- Conflict resolution for simultaneous edits
- Syntax highlighting for multiple languages

### Video Chat Integration

- PeerJS-based WebRTC implementation
- Automatic connection management
- Audio/video controls with mute/unmute
- Fallback to cloud signaling servers

### Interactive Whiteboard

- Fabric.js canvas for drawing tools
- Real-time collaborative drawing
- Multiple drawing tools (pencil, shapes, text)
- Color palette and brush size controls

### Code Execution

- Integration with Judge0 API via RapidAPI
- Support for multiple programming languages
- Real-time output display
- Error handling and timeout management

## 🔌 Backend Integration

The frontend communicates with the backend through:

- **REST API**: User management, session data, metrics
- **WebSocket**: Real-time collaboration, chat, presence
- **Firebase**: Authentication and user data

### API Endpoints

- `/api/users` - User management
- `/api/sessions` - Session management
- `/api/code/execute` - Code execution
- `/api/metrics` - User analytics

## 🚀 Deployment

### Development Deployment

```bash
npm run build:dev
```

### Production Deployment

```bash
npm run build:prod
```

The built files will be in the `dist/` directory, ready for deployment to platforms like:

- Netlify
- Vercel
- AWS S3
- GitHub Pages

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📝 License

This project is licensed under the ISC License.

## 🆘 Support

For support and questions:

- Check the backend README for server setup
- Review the environment configuration
- Ensure all dependencies are properly installed
- Verify backend server is running and accessible
