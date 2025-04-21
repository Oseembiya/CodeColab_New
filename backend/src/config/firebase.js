const admin = require("firebase-admin");
const dotenv = require("dotenv");

dotenv.config();

// Add debugging statements
console.log("Firebase config setup starting...");

let credentials;
let firebaseConfigValid = false;

// Method 1: Check for JSON string in FIREBASE_SERVICE_ACCOUNT
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    console.log("Using FIREBASE_SERVICE_ACCOUNT method");

    // Parse the complete service account JSON
    const serviceAccountJson = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    credentials = serviceAccountJson;

    // Verify we have the required fields
    if (
      credentials.private_key &&
      credentials.client_email &&
      credentials.project_id
    ) {
      console.log(
        "Service account JSON successfully parsed with all required fields"
      );
      firebaseConfigValid = true;
    } else {
      console.log("Service account JSON missing required fields");
    }
  } catch (error) {
    console.error(
      "Failed to parse FIREBASE_SERVICE_ACCOUNT as JSON:",
      error.message
    );
  }
}

// Method 2: Use individual environment variables
if (!firebaseConfigValid && process.env.FIREBASE_PRIVATE_KEY) {
  try {
    console.log("Using individual environment variables method");

    // Create credentials object manually
    credentials = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
    };

    if (
      credentials.private_key &&
      credentials.client_email &&
      credentials.project_id
    ) {
      console.log("Individual credential fields processed successfully");
      firebaseConfigValid = true;
    } else {
      console.log(
        "Missing required credential fields from environment variables"
      );
    }
  } catch (error) {
    console.error("Error setting up individual credentials:", error.message);
  }
}

// Method 3: Direct initialization if we have the minimum required fields
if (!firebaseConfigValid && process.env.FIREBASE_PROJECT_ID) {
  console.log("Attempting minimalist configuration...");
  try {
    // Initialize with minimal config and default application credentials
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
    console.log("Firebase initialized with minimal configuration");
    firebaseConfigValid = true;
  } catch (error) {
    console.error("Minimal initialization failed:", error.message);
  }
}

// Initialize Firebase if we have valid credentials
if (firebaseConfigValid && !admin.apps.length) {
  try {
    if (credentials) {
      admin.initializeApp({
        credential: admin.credential.cert(credentials),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
      });
    }
    console.log("Firebase Admin SDK initialized successfully");
  } catch (error) {
    console.error("Firebase initialization error:", error);

    // As a last resort, try initializing without credentials
    if (!admin.apps.length) {
      try {
        admin.initializeApp();
        console.log(
          "Firebase initialized without credentials (limited functionality)"
        );
      } catch (e) {
        console.error("Failed to initialize Firebase without credentials:", e);
      }
    }
  }
} else if (!firebaseConfigValid) {
  console.error(
    "CRITICAL: Unable to initialize Firebase with any method. The application will run with limited functionality."
  );
}

// Get Firebase services
let db = null;
let auth = null;

try {
  if (admin.apps.length) {
    db = admin.firestore();
    auth = admin.auth();
    console.log("Firebase services initialized");
  }
} catch (error) {
  console.error("Failed to initialize Firebase services:", error);
}

module.exports = { admin, db, auth };
