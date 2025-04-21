# CodeColab Frontend

This is the frontend application for CodeColab, a real-time collaborative coding platform.

## Environment Setup

CodeColab frontend uses environment variables for configuration. We provide configuration files for both development and production environments.

### Development Environment

1. Copy the environment template for development:

   ```bash
   cp .env.development .env
   ```

2. Modify any values in `.env` as needed for your local development.

3. Start the development server:
   ```bash
   npm run dev
   ```

### Production Environment

1. Copy the environment template for production:

   ```bash
   cp .env.production .env
   ```

2. Update the following critical settings in your `.env` file:

   - `VITE_API_URL` - Set to your production backend API URL
   - `VITE_SOCKET_URL` - Set to your production backend Socket.IO URL
   - Firebase credentials (if using different Firebase project)

3. Build the production application:

   ```bash
   npm run build
   ```

4. The built files will be in the `dist` directory, ready to be deployed to your hosting platform.

## Environment Variables Reference

### Firebase Configuration

- `VITE_FIREBASE_API_KEY` - Firebase API key
- `VITE_FIREBASE_AUTH_DOMAIN` - Firebase Auth domain
- `VITE_FIREBASE_PROJECT_ID` - Firebase project ID
- `VITE_FIREBASE_STORAGE_BUCKET` - Firebase storage bucket
- `VITE_FIREBASE_MESSAGING_SENDER_ID` - Firebase messaging sender ID
- `VITE_FIREBASE_APP_ID` - Firebase app ID
- `VITE_FIREBASE_MEASUREMENT_ID` - Firebase measurement ID

### Backend Connection

- `VITE_API_URL` - URL of the backend API
- `VITE_SOCKET_URL` - URL for Socket.IO connection
- `VITE_USE_EMULATORS` - Whether to use Firebase emulators (true/false)

### Debug and Development

- `VITE_ENABLE_DEBUG_LOGS` - Enable debug logs (true/false)
- `VITE_ENABLE_PERFORMANCE_TRACKING` - Enable performance tracking (true/false)

### Feature Flags

- `VITE_FEATURE_COLLABORATIVE_WHITEBOARD` - Enable collaborative whiteboard (true/false)
- `VITE_FEATURE_VIDEO_CHAT` - Enable video chat (true/false)
- `VITE_FEATURE_CODE_EXECUTION` - Enable code execution (true/false)

### Production-specific

- `VITE_ENABLE_ANALYTICS` - Enable analytics (true/false)
- `VITE_SENTRY_DSN` - Sentry DSN for error tracking
- `VITE_APP_VERSION` - Application version
- `VITE_API_CACHE_TIME` - API cache time in seconds
- `VITE_ENABLE_SERVICE_WORKER` - Enable service worker for offline capabilities (true/false)
