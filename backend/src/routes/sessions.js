const express = require("express");
const router = express.Router();
const { db } = require("../config/firebase");
const { authenticateUser } = require("../middleware/auth");

// Collection reference
const sessionsCollection = db.collection("sessions");

// Create a new session
router.post("/", authenticateUser, async (req, res) => {
  try {
    const { title, language, description, isPublic } = req.body;

    if (!title) {
      return res.status(400).json({
        status: "error",
        message: "Session title is required",
      });
    }

    // Generate a unique 6-character session code
    const generateSessionCode = () => {
      const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed similar looking characters
      let code = "";
      for (let i = 0; i < 6; i++) {
        code += characters.charAt(
          Math.floor(Math.random() * characters.length)
        );
      }
      return code;
    };

    // Make sure the code is unique
    let sessionCode = generateSessionCode();
    let codeExists = true;
    while (codeExists) {
      const existingSession = await sessionsCollection
        .where("sessionCode", "==", sessionCode)
        .limit(1)
        .get();
      if (existingSession.empty) {
        codeExists = false;
      } else {
        sessionCode = generateSessionCode();
      }
    }

    const session = {
      title,
      language: language || "javascript",
      description: description || "",
      code: "",
      createdBy: req.user.uid,
      createdAt: new Date(),
      participants: [req.user.uid],
      isActive: true,
      isPublic: isPublic === undefined ? false : isPublic,
      sessionCode: sessionCode, // Add the session code
    };

    const docRef = await sessionsCollection.add(session);

    res.status(201).json({
      status: "success",
      data: {
        id: docRef.id,
        ...session,
      },
    });
  } catch (error) {
    console.error("Error creating session:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to create session",
    });
  }
});

// Get public sessions
router.get("/public", async (req, res) => {
  try {
    const sessionsSnapshot = await sessionsCollection
      .where("isPublic", "==", true)
      .where("isActive", "==", true)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const sessions = [];
    sessionsSnapshot.forEach((doc) => {
      const data = doc.data();
      sessions.push({
        id: doc.id,
        name: data.title,
        description: data.description,
        language: data.language,
        createdAt: data.createdAt.toDate(),
        participants: data.participants.length,
        isPublic: data.isPublic,
        status: data.isActive ? "active" : "ended",
      });
    });

    res.status(200).json({
      status: "success",
      data: sessions,
    });
  } catch (error) {
    console.error("Error fetching public sessions:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch public sessions",
    });
  }
});

// Get all sessions (both public and private)
router.get("/all", async (req, res) => {
  try {
    const sessionsSnapshot = await sessionsCollection
      .where("isActive", "==", true)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const sessions = [];
    sessionsSnapshot.forEach((doc) => {
      const data = doc.data();
      sessions.push({
        id: doc.id,
        name: data.title,
        description: data.description,
        language: data.language,
        createdAt: data.createdAt.toDate(),
        participants: data.participants.length,
        isPublic: data.isPublic,
        status: data.isActive ? "active" : "ended",
      });
    });

    res.status(200).json({
      status: "success",
      data: sessions,
    });
  } catch (error) {
    console.error("Error fetching all sessions:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch all sessions",
    });
  }
});

// Get all sessions for a user
router.get("/", authenticateUser, async (req, res) => {
  try {
    const sessionsSnapshot = await sessionsCollection
      .where("participants", "array-contains", req.user.uid)
      .get();

    const sessions = [];
    sessionsSnapshot.forEach((doc) => {
      const data = doc.data();
      sessions.push({
        id: doc.id,
        name: data.title,
        description: data.description,
        language: data.language,
        createdAt: data.createdAt.toDate(),
        participants: data.participants.length,
        isPublic: data.isPublic,
        status: data.isActive ? "active" : "ended",
      });
    });

    res.status(200).json({
      status: "success",
      data: sessions,
    });
  } catch (error) {
    console.error("Error fetching sessions:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch sessions",
    });
  }
});

// Get a specific session
router.get("/:id", authenticateUser, async (req, res) => {
  try {
    const sessionDoc = await sessionsCollection.doc(req.params.id).get();

    if (!sessionDoc.exists) {
      return res.status(404).json({
        status: "error",
        message: "Session not found",
      });
    }

    const sessionData = sessionDoc.data();

    // Check if user is a participant
    if (!sessionData.participants.includes(req.user.uid)) {
      return res.status(403).json({
        status: "error",
        message: "Access denied: You are not a participant in this session",
      });
    }

    res.status(200).json({
      status: "success",
      data: {
        id: sessionDoc.id,
        ...sessionData,
      },
    });
  } catch (error) {
    console.error("Error fetching session:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch session",
    });
  }
});

// Update a session
router.put("/:id", authenticateUser, async (req, res) => {
  try {
    const sessionRef = sessionsCollection.doc(req.params.id);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      return res.status(404).json({
        status: "error",
        message: "Session not found",
      });
    }

    const sessionData = sessionDoc.data();

    // Check if user is a participant
    if (!sessionData.participants.includes(req.user.uid)) {
      return res.status(403).json({
        status: "error",
        message: "Access denied: You are not a participant in this session",
      });
    }

    const { title, language, description, code } = req.body;
    const updateData = {};

    if (title) updateData.title = title;
    if (language) updateData.language = language;
    if (description !== undefined) updateData.description = description;
    if (code !== undefined) updateData.code = code;

    await sessionRef.update({
      ...updateData,
      updatedAt: new Date(),
    });

    res.status(200).json({
      status: "success",
      message: "Session updated successfully",
    });
  } catch (error) {
    console.error("Error updating session:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to update session",
    });
  }
});

// Add a participant to a session
router.post("/:id/participants", authenticateUser, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        status: "error",
        message: "Participant email is required",
      });
    }

    // Get user by email
    const userRecord = await db
      .collection("users")
      .where("email", "==", email)
      .limit(1)
      .get();

    if (userRecord.empty) {
      return res.status(404).json({
        status: "error",
        message: "User not found with the provided email",
      });
    }

    const userId = userRecord.docs[0].id;

    // Get session
    const sessionRef = sessionsCollection.doc(req.params.id);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      return res.status(404).json({
        status: "error",
        message: "Session not found",
      });
    }

    const sessionData = sessionDoc.data();

    // Check if user is already a participant
    if (sessionData.participants.includes(userId)) {
      return res.status(400).json({
        status: "error",
        message: "User is already a participant in this session",
      });
    }

    // Add user to participants
    await sessionRef.update({
      participants: [...sessionData.participants, userId],
      updatedAt: new Date(),
    });

    res.status(200).json({
      status: "success",
      message: "Participant added successfully",
    });
  } catch (error) {
    console.error("Error adding participant:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to add participant",
    });
  }
});

// Delete a session
router.delete("/:id", authenticateUser, async (req, res) => {
  try {
    const sessionRef = sessionsCollection.doc(req.params.id);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      return res.status(404).json({
        status: "error",
        message: "Session not found",
      });
    }

    const sessionData = sessionDoc.data();

    // Check if user is the creator
    if (sessionData.createdBy !== req.user.uid) {
      return res.status(403).json({
        status: "error",
        message: "Access denied: Only the session creator can delete it",
      });
    }

    await sessionRef.delete();

    res.status(200).json({
      status: "success",
      message: "Session deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting session:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to delete session",
    });
  }
});

// Join a session
router.post("/:id/join", authenticateUser, async (req, res) => {
  try {
    const sessionRef = sessionsCollection.doc(req.params.id);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      return res.status(404).json({
        status: "error",
        message: "Session not found",
      });
    }

    const sessionData = sessionDoc.data();

    // Check if user is already a participant
    if (sessionData.participants.includes(req.user.uid)) {
      return res.status(200).json({
        status: "success",
        message: "User is already a participant",
        data: {
          id: sessionDoc.id,
          name: sessionData.title,
          description: sessionData.description,
          language: sessionData.language,
          createdAt: sessionData.createdAt.toDate(),
          participants: sessionData.participants.length,
          isPublic: sessionData.isPublic,
          status: sessionData.isActive ? "active" : "ended",
        },
      });
    }

    // Check if session is public or user has access
    if (!sessionData.isPublic) {
      // Here you could implement additional access checks
      // For example, check if user was invited
      // For now, we'll allow access if they know the ID
    }

    // Add user to participants
    await sessionRef.update({
      participants: [...sessionData.participants, req.user.uid],
      updatedAt: new Date(),
    });

    sessionData.participants.push(req.user.uid);

    res.status(200).json({
      status: "success",
      message: "Successfully joined session",
      data: {
        id: sessionDoc.id,
        name: sessionData.title,
        description: sessionData.description,
        language: sessionData.language,
        createdAt: sessionData.createdAt.toDate(),
        participants: sessionData.participants.length,
        isPublic: sessionData.isPublic,
        status: sessionData.isActive ? "active" : "ended",
      },
    });
  } catch (error) {
    console.error("Error joining session:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to join session",
    });
  }
});

// Check if a session exists (no auth required)
router.get("/:id/exists", async (req, res) => {
  try {
    const sessionDoc = await sessionsCollection.doc(req.params.id).get();

    res.status(200).json({
      exists: sessionDoc.exists,
    });
  } catch (error) {
    console.error("Error checking session:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to check session",
    });
  }
});

// Resolve a session code to a session ID
router.get("/code/:code", async (req, res) => {
  try {
    const sessionCode = req.params.code.toUpperCase(); // Normalize to uppercase

    if (!sessionCode || sessionCode.length !== 6) {
      return res.status(400).json({
        status: "error",
        message: "Invalid session code format",
      });
    }

    const sessionsSnapshot = await sessionsCollection
      .where("sessionCode", "==", sessionCode)
      .where("isActive", "==", true)
      .limit(1)
      .get();

    if (sessionsSnapshot.empty) {
      return res.status(404).json({
        status: "error",
        message: "No active session found with this code",
      });
    }

    // Return just the session ID
    const sessionDoc = sessionsSnapshot.docs[0];
    res.status(200).json({
      status: "success",
      data: {
        sessionId: sessionDoc.id,
      },
    });
  } catch (error) {
    console.error("Error resolving session code:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to resolve session code",
    });
  }
});

module.exports = router;
