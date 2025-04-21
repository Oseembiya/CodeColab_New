# CodeColab Backend

This is the backend server for CodeColab, a real-time collaborative coding platform.

## Environment Setup

CodeColab backend uses environment variables for configuration. We provide configuration files for both development and production environments.

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

   - `FRONTEND_URL` - Set to your production frontend domain
   - `CORS_ORIGIN` - Set to your production frontend domain
   - `SOCKET_CORS_ORIGIN` - Set to your production frontend domain
   - `SESSION_SECRET` - Change to a secure random string
   - Firebase credentials (if using different Firebase project)

3. Start the production server:
   ```bash
   npm run start
   ```

## Environment Variables Reference

### Firebase Configuration

- `FIREBASE_API_KEY` - Firebase API key
- `FIREBASE_AUTH_DOMAIN` - Firebase Auth domain
- `FIREBASE_PROJECT_ID` - Firebase project ID
- `FIREBASE_STORAGE_BUCKET` - Firebase storage bucket
- `FIREBASE_MESSAGING_SENDER_ID` - Firebase messaging sender ID
- `FIREBASE_APP_ID` - Firebase app ID
- `FIREBASE_MEASUREMENT_ID` - Firebase measurement ID
- `FIREBASE_CLIENT_EMAIL` - Firebase Admin SDK client email
- `FIREBASE_PRIVATE_KEY` - Firebase Admin SDK private key
- `FIREBASE_DATABASE_URL` - Firebase database URL

### Server Configuration

- `PORT` - Server port (default: 3001 for dev, 3000 for prod)
- `NODE_ENV` - Environment ('development' or 'production')
- `DEBUG` - Debug output configuration

### CORS and Security

- `FRONTEND_URL` - URL of the frontend application
- `CORS_ORIGIN` - Origin for CORS
- `SESSION_SECRET` - Secret for session
- `SOCKET_CORS_ORIGIN` - Origin for Socket.IO CORS

### External APIs

- `RAPIDAPI_KEY` - API key for RapidAPI (for code execution)

### Production-specific

- `SOCKET_MAX_CONNECTIONS` - Maximum number of socket connections
- `DB_CONNECTION_POOL_SIZE` - Database connection pool size
- `RATE_LIMIT_WINDOW_MS` - Rate limiting window in milliseconds
- `RATE_LIMIT_MAX` - Maximum requests within rate limiting window
