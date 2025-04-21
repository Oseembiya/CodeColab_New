const { auth } = require("../config/firebase");

// Middleware to verify Firebase authentication token
const authenticateUser = async (req, res, next) => {
  try {
    // Get authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized: No token provided",
      });
    }

    // Extract token
    const token = authHeader.split(" ")[1];

    // Verify token with Firebase
    const decodedToken = await auth.verifyIdToken(token);

    // Add user to request object
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name || decodedToken.email,
    };

    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(401).json({
      status: "error",
      message: "Unauthorized: Invalid token",
    });
  }
};

module.exports = { authenticateUser };
