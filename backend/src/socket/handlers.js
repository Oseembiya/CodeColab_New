const { db } = require("../config/firebase");

// Socket event handlers
const setupSocketHandlers = (io) => {
  // Active users in each session
  const activeUsers = new Map();

  // Active user-session pairs to prevent duplicate joins
  const activeUserSessions = new Set();

  // Track authentication attempts to prevent spamming
  const authAttempts = new Map();

  // Reference to platform metrics in Firestore
  const platformMetricsRef = db.collection("platformMetrics").doc("global");

  // Global stats tracker
  let globalStats = {
    activeSessions: 0,
    collaboratingUsers: 0,
    totalLinesOfCode: 0,
    lastUpdated: new Date(),
  };

  // Track whiteboard state for each session
  const whiteboardStates = new Map();

  // Load existing metrics from Firestore on startup
  platformMetricsRef
    .get()
    .then((doc) => {
      if (doc.exists) {
        // Initialize with stored metrics
        const storedMetrics = doc.data();
        globalStats = {
          ...globalStats,
          ...storedMetrics,
          lastUpdated: new Date(), // Reset the timestamp to now
        };
      } else {
        // First time - create the document
        platformMetricsRef
          .set(globalStats)
          .then(() => console.log("Initialized platform metrics in Firestore"))
          .catch((err) =>
            console.error("Error initializing platform metrics:", err)
          );
      }
    })
    .catch((err) => console.error("Error loading platform metrics:", err));

  // Function to update global stats
  const updateGlobalStats = () => {
    // Count active sessions
    const uniqueSessionIds = new Set();
    for (const userSession of activeUserSessions) {
      const [, sessionId] = userSession.split(":");
      uniqueSessionIds.add(sessionId);
    }

    // Update current metrics
    globalStats.activeSessions = uniqueSessionIds.size;
    globalStats.collaboratingUsers = activeUserSessions.size;
    globalStats.lastUpdated = new Date();

    // Save metrics to Firestore
    platformMetricsRef
      .set(globalStats, { merge: true })
      .catch((err) => console.error("Error saving platform metrics:", err));

    // Broadcast updated stats to all connected clients
    io.emit("global-stats", globalStats);
  };

  // Update stats periodically
  setInterval(updateGlobalStats, 30000); // Update every 30 seconds

  // Save historical metrics data daily
  const saveHistoricalMetrics = () => {
    const now = new Date();
    const timestamp = now.toISOString().split("T")[0]; // YYYY-MM-DD format

    db.collection("Platform-Metrics-History")
      .doc(timestamp)
      .set(
        {
          timestamp: now,
          activeSessions: globalStats.activeSessions,
          collaboratingUsers: globalStats.collaboratingUsers,
          totalLinesOfCode: globalStats.totalLinesOfCode,
        },
        { merge: true }
      )
      .then(() => console.log(`Saved historical metrics for ${timestamp}`))
      .catch((err) => console.error("Error saving historical metrics:", err));
  };

  // Schedule daily metrics snapshot at midnight
  const scheduleHistoricalSave = () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const timeUntilMidnight = tomorrow - now;
    console.log(
      `Scheduling historical metrics save in ${Math.round(
        timeUntilMidnight / 1000 / 60
      )} minutes`
    );

    setTimeout(() => {
      saveHistoricalMetrics();
      // Schedule next save
      setInterval(saveHistoricalMetrics, 24 * 60 * 60 * 1000); // Every 24 hours
    }, timeUntilMidnight);
  };

  // Start the scheduling
  scheduleHistoricalSave();

  io.on("connection", (socket) => {
    let currentSessionId = null;
    let currentUser = null;

    // Listen for global stats requests
    socket.on("request-global-stats", () => {
      // Send current stats to the requesting client
      socket.emit("global-stats", globalStats);
    });

    // Handle user authentication and joining session
    socket.on("authenticate", async (data) => {
      try {
        const { sessionId, user } = data;

        if (!sessionId || !user) {
          socket.emit("error", {
            message: "Session ID and user data are required",
          });
          return;
        }

        console.log(`User ${user.uid} authenticating for session ${sessionId}`);

        // Throttle authentication attempts
        const now = Date.now();
        const authKey = `${user.uid}:${sessionId}:${socket.id}`;

        if (authAttempts.has(authKey)) {
          const lastAttempt = authAttempts.get(authKey);
          const timeSinceLastAttempt = now - lastAttempt;

          // If less than 5 seconds since last attempt, ignore this call
          if (timeSinceLastAttempt < 5000) {
            console.log(
              `Throttling auth attempt for ${authKey}, only ${timeSinceLastAttempt}ms since last attempt`
            );
            return;
          }
        }

        // Update last attempt time
        authAttempts.set(authKey, now);

        // Clean up old auth attempts (older than 1 minute)
        const toDelete = [];
        for (const [key, timestamp] of authAttempts.entries()) {
          if (now - timestamp > 60000) {
            toDelete.push(key);
          }
        }

        toDelete.forEach((key) => authAttempts.delete(key));

        // Check if this user is already in this session (prevent duplicate joins)
        const userSessionKey = `${user.uid}:${sessionId}`;
        if (activeUserSessions.has(userSessionKey)) {
          console.log(
            `User ${user.uid} already in session ${sessionId}, updating socket ID`
          );

          // Just update the socket ID mapping
          if (activeUsers.has(sessionId)) {
            const users = activeUsers.get(sessionId);
            // Find and update any previous entries for this user
            let existingSocketFound = false;
            for (const [existingSocketId, userData] of users.entries()) {
              if (userData.id === user.uid) {
                if (existingSocketId !== socket.id) {
                  console.log(
                    `Updating socket ID from ${existingSocketId} to ${socket.id} for user ${user.uid}`
                  );
                  users.delete(existingSocketId);
                  existingSocketFound = true;
                } else {
                  console.log(
                    `User ${user.uid} already has correct socket ID ${socket.id}`
                  );
                }
                break;
              }
            }

            if (!existingSocketFound) {
              console.log(
                `No existing socket found for user ${user.uid}, adding new mapping`
              );
            }
          }
        } else {
          console.log(
            `User ${user.uid} joined session ${sessionId} (new user-session pair)`
          );
          activeUserSessions.add(userSessionKey);
        }

        // Store user data
        currentUser = user;
        currentSessionId = sessionId;

        // Join the session room
        socket.join(sessionId);

        // Add user to active users for this session
        if (!activeUsers.has(sessionId)) {
          activeUsers.set(sessionId, new Map());
        }

        activeUsers.get(sessionId).set(socket.id, {
          id: user.uid,
          name: user.displayName || user.email,
          avatar: user.photoURL,
          socketId: socket.id,
          isActive: true,
          isHost: false, // Can set host based on session creator
        });

        // Notify all users in the session about the updated user list
        const sessionUsers = Array.from(activeUsers.get(sessionId).values());

        console.log(
          `Emitting users-update with ${sessionUsers.length} users for session ${sessionId}`
        );
        io.to(sessionId).emit("users-update", sessionUsers);

        // Notify the user that they've successfully joined
        socket.emit("joined-session", {
          sessionId,
          users: sessionUsers,
        });
      } catch (error) {
        console.error("Authentication error:", error);
        socket.emit("error", { message: "Failed to authenticate" });
      }
    });

    // Handle end-session event - sent by the owner to notify all participants
    socket.on("end-session", async (data) => {
      try {
        const { sessionId, userId } = data;

        if (!sessionId) {
          socket.emit("error", { message: "Session ID is required" });
          return;
        }

        console.log(`User ${userId} requesting to end session ${sessionId}`);

        // Verify if the user is the session owner
        const sessionRef = db.collection("sessions").doc(sessionId);
        const sessionDoc = await sessionRef.get();

        if (!sessionDoc.exists) {
          socket.emit("error", { message: "Session not found" });
          return;
        }

        const sessionData = sessionDoc.data();
        if (sessionData.createdBy !== userId) {
          socket.emit("error", {
            message: "Only the session owner can end the session",
          });
          return;
        }

        // Update the session in the database
        await sessionRef.update({
          isActive: false,
          status: "ended",
          updatedAt: new Date(),
        });
        console.log(
          `Updated session ${sessionId} status to ended in the database`
        );

        // Count how many clients will receive this notification
        const room = io.sockets.adapter.rooms.get(sessionId);
        const clientCount = room ? room.size : 0;
        console.log(
          `Broadcasting session-ended event to ${clientCount} clients in room ${sessionId}`
        );

        // Notify all users in the session that it has ended
        io.to(sessionId).emit("session-ended", {
          sessionId,
          message: "The session owner has ended this session",
          endedBy: userId,
        });

        // Also log all socket IDs who should receive this
        if (room) {
          const socketIds = Array.from(room);
          console.log(
            `Socket IDs in room ${sessionId}: ${socketIds.join(", ")}`
          );
        }

        console.log(
          `Session ${sessionId} has been ended by ${userId}, notified all participants`
        );
      } catch (error) {
        console.error("Error ending session:", error);
        socket.emit("error", { message: "Failed to end session" });
      }
    });

    // Handle join-session event
    socket.on("join-session", (sessionId) => {
      if (!sessionId) {
        socket.emit("error", { message: "Session ID is required" });
        return;
      }

      console.log(`Socket ${socket.id} joining session room: ${sessionId}`);

      // Set the current session ID for this socket
      currentSessionId = sessionId;

      // Join the session room
      socket.join(sessionId);

      // Notify the client they've joined the session
      socket.emit("joined-session-room", { sessionId });
    });

    // Handle leave-session event
    socket.on("leave-session", (data) => {
      const { sessionId, userId } = data;

      if (!sessionId) {
        socket.emit("error", { message: "Session ID is required" });
        return;
      }

      console.log(`User ${userId || "unknown"} leaving session ${sessionId}`);

      // Leave the socket room
      socket.leave(sessionId);

      // Clean up user data if we have it
      if (activeUsers.has(sessionId)) {
        const users = activeUsers.get(sessionId);

        // Find user by socket ID or provided userID
        let removedUser = userId
          ? Array.from(users.values()).find((u) => u.id === userId)
          : Array.from(users.values()).find((u) => u.socketId === socket.id);

        // If we couldn't find the user but have a userId, create a temporary user object
        // for cleanup purposes
        if (!removedUser && userId) {
          removedUser = { id: userId };
          console.log(`Creating temporary user object for cleanup: ${userId}`);
        }

        if (removedUser) {
          console.log(
            `Removing user ${removedUser.id} from session ${sessionId}`
          );

          // Remove user from active users by socket ID
          const userSocketId = Array.from(users.entries()).find(
            ([socketId, user]) => user.id === removedUser.id
          )?.[0];

          if (userSocketId) {
            users.delete(userSocketId);
          } else {
            // Just try the current socket as fallback
            users.delete(socket.id);
          }

          // Clean up user-session mapping
          const userSessionKey = `${removedUser.id}:${sessionId}`;
          activeUserSessions.delete(userSessionKey);

          // Notify remaining users about user list change
          const sessionUsers = Array.from(users.values());

          console.log(
            `Emitting updated users (${sessionUsers.length}) after user left`
          );
          io.to(sessionId).emit("users-update", sessionUsers);
        }
      }

      // If this was the current session for this socket, clear it
      if (currentSessionId === sessionId) {
        currentSessionId = null;
      }
    });

    // Handle code changes and update line count metrics
    socket.on("code-change", (data) => {
      if (!currentSessionId) {
        socket.emit("error", { message: "You must join a session first" });
        return;
      }

      // Track lines of code - count actual lines in the content
      if (data.content) {
        // Count the number of lines in the code
        const lineCount = data.content.split("\n").length;

        // Update the global stats with the total line count
        if (!globalStats.lastLineCount) {
          globalStats.lastLineCount = {};
        }

        // Get previous line count for this session (or 0 if first time)
        const prevLineCount = globalStats.lastLineCount[currentSessionId] || 0;

        // If new count is higher, update the total
        if (lineCount > prevLineCount) {
          const linesAdded = lineCount - prevLineCount;
          globalStats.totalLinesOfCode += linesAdded;
          globalStats.lastLineCount[currentSessionId] = lineCount;
        }
      }

      // Add user information to the data
      const enrichedData = {
        ...data,
        user: currentUser
          ? {
              id: currentUser.uid,
              name: currentUser.displayName || currentUser.email,
            }
          : null,
      };

      // Broadcast to everyone in the session except the sender
      socket.to(currentSessionId).emit("code-update", enrichedData);

      // Update code in the database (throttled to prevent excessive writes)
      updateSessionCode(currentSessionId, data.code);
    });

    // Handle whiteboard drawing
    socket.on("whiteboard-draw", (data) => {
      if (!currentSessionId) {
        socket.emit("error", { message: "You must join a session first" });
        return;
      }

      // Add user information to the data
      const enrichedData = {
        ...data,
        user: currentUser
          ? {
              id: currentUser.uid,
              name: currentUser.displayName || currentUser.email,
            }
          : null,
      };

      // Ensure each object has a unique ID for identification
      if (enrichedData.objects && Array.isArray(enrichedData.objects)) {
        enrichedData.objects.forEach((obj) => {
          if (!obj.id) {
            obj.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          }
        });
      }

      // Store whiteboard objects for persistence
      if (!whiteboardStates.has(currentSessionId)) {
        whiteboardStates.set(currentSessionId, []);
      }

      const sessionWhiteboardState = whiteboardStates.get(currentSessionId);

      // Add new objects to the stored state
      if (enrichedData.objects && Array.isArray(enrichedData.objects)) {
        enrichedData.objects.forEach((obj) => {
          // Check if this object already exists in state (by ID)
          const existingIndex = sessionWhiteboardState.findIndex(
            (existingObj) => existingObj.id === obj.id
          );

          if (existingIndex >= 0) {
            // Update existing object
            sessionWhiteboardState[existingIndex] = obj;
          } else {
            // Add new object
            sessionWhiteboardState.push(obj);
          }
        });
      }

      // Broadcast to everyone in the session except the sender
      socket.to(currentSessionId).emit("whiteboard-draw", enrichedData);
    });

    // Handle whiteboard clear
    socket.on("whiteboard-clear", (data) => {
      if (!currentSessionId) {
        socket.emit("error", { message: "You must join a session first" });
        return;
      }

      // Add user information to the data
      const enrichedData = {
        ...data,
        user: currentUser
          ? {
              id: currentUser.uid,
              name: currentUser.displayName || currentUser.email,
            }
          : null,
      };

      // Clear stored whiteboard state
      if (whiteboardStates.has(currentSessionId)) {
        whiteboardStates.set(currentSessionId, []);
      }

      // Broadcast to everyone in the session except the sender
      socket.to(currentSessionId).emit("whiteboard-clear", enrichedData);
    });

    // Handle challenge selection
    socket.on("challenge-selected", (data) => {
      if (!currentSessionId) {
        socket.emit("error", { message: "You must join a session first" });
        return;
      }

      // Add user information to the data if not already present
      const enrichedData = {
        ...data,
        user: currentUser
          ? {
              id: currentUser.uid,
              name: currentUser.displayName || currentUser.email,
            }
          : null,
      };

      // Broadcast to everyone in the session except the sender
      socket.to(currentSessionId).emit("challenge-selected", enrichedData);
    });

    // Handle challenge closed
    socket.on("challenge-closed", (data) => {
      if (!currentSessionId) {
        socket.emit("error", { message: "You must join a session first" });
        return;
      }

      // Broadcast to everyone in the session except the sender
      socket.to(currentSessionId).emit("challenge-closed", data);
    });

    // Handle whiteboard updates
    socket.on("whiteboard-update", (data) => {
      if (!currentSessionId) {
        socket.emit("error", { message: "You must join a session first" });
        return;
      }

      // Add user information to the data
      const enrichedData = {
        ...data,
        user: currentUser
          ? {
              id: currentUser.uid,
              name: currentUser.displayName || currentUser.email,
            }
          : null,
      };

      // Ensure object has an ID for identification
      if (enrichedData.object && !enrichedData.object.id) {
        enrichedData.object.id = `${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`;
      }

      // Update in stored whiteboard state
      if (whiteboardStates.has(currentSessionId) && enrichedData.object) {
        const sessionWhiteboardState = whiteboardStates.get(currentSessionId);

        // Find and update the object in the state
        const existingIndex = sessionWhiteboardState.findIndex(
          (obj) => obj.id === enrichedData.object.id
        );

        if (existingIndex >= 0) {
          // Update existing object
          sessionWhiteboardState[existingIndex] = enrichedData.object;
        } else {
          // Add as new object if not found
          sessionWhiteboardState.push(enrichedData.object);
        }
      }

      // Broadcast to everyone in the session except the sender
      socket.to(currentSessionId).emit("whiteboard-update", enrichedData);
    });

    // Handle whiteboard state requests
    socket.on("whiteboard-request-state", async (data) => {
      if (!currentSessionId) {
        socket.emit("error", { message: "You must join a session first" });
        return;
      }

      const { sessionId } = data;

      if (sessionId !== currentSessionId) {
        socket.emit("error", { message: "Session ID mismatch" });
        return;
      }

      console.log(
        `User ${
          currentUser?.uid || socket.id
        } requested whiteboard state for session ${sessionId}`
      );

      // Check if we have stored state first
      if (
        whiteboardStates.has(sessionId) &&
        whiteboardStates.get(sessionId).length > 0
      ) {
        // Send the stored state directly to the requesting client
        const storedObjects = whiteboardStates.get(sessionId);

        console.log(
          `Sending stored whiteboard state with ${storedObjects.length} objects`
        );

        socket.emit("whiteboard-state", {
          sessionId,
          objects: storedObjects,
          source: "server-stored",
        });
      } else {
        // Fall back to requesting state from other clients
        socket.to(sessionId).emit("whiteboard-state-request", {
          sessionId,
          requestingUserId: currentUser?.uid || socket.id,
          socketId: socket.id,
        });
      }
    });

    // Handle whiteboard state response
    socket.on("whiteboard-state-response", (data) => {
      if (!currentSessionId) {
        socket.emit("error", { message: "You must join a session first" });
        return;
      }

      const { sessionId, objects, targetSocketId } = data;

      if (!targetSocketId || !sessionId || !objects) {
        socket.emit("error", { message: "Invalid state response data" });
        return;
      }

      console.log(
        `User ${
          currentUser?.uid || socket.id
        } sending whiteboard state to ${targetSocketId}`
      );

      // Update the stored state with these objects
      if (objects.length > 0) {
        if (!whiteboardStates.has(sessionId)) {
          whiteboardStates.set(sessionId, [...objects]);
        } else {
          const currentState = whiteboardStates.get(sessionId);

          // Merge objects, updating existing ones and adding new ones
          objects.forEach((newObj) => {
            const existingIndex = currentState.findIndex(
              (obj) => obj.id === newObj.id
            );
            if (existingIndex >= 0) {
              currentState[existingIndex] = newObj;
            } else {
              currentState.push(newObj);
            }
          });
        }
      }

      // Send the state directly to the requesting socket
      io.to(targetSocketId).emit("whiteboard-state", {
        sessionId,
        objects,
        user: currentUser
          ? {
              id: currentUser.uid,
              name: currentUser.displayName || currentUser.email,
            }
          : null,
      });
    });

    // Handle chat messages
    socket.on("chat-message", (data) => {
      if (!currentSessionId || !currentUser) {
        socket.emit("error", { message: "You must join a session first" });
        return;
      }

      const messageData = {
        text: data.text,
        timestamp: new Date(),
        user: {
          id: currentUser.uid,
          name: currentUser.displayName || currentUser.email,
          avatar: currentUser.photoURL,
        },
      };

      // Broadcast to everyone in the session (including the sender)
      io.to(currentSessionId).emit("chat-message", messageData);
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      // Clean up session data if the user was in a session
      if (currentSessionId && activeUsers.has(currentSessionId)) {
        const users = activeUsers.get(currentSessionId);
        const user = Array.from(users.values()).find(
          (u) => u.socketId === socket.id
        );

        // Only remove if we found the user
        if (user) {
          // Remove user from active users
          users.delete(socket.id);

          // Clean up user session tracking - but only if there are no other
          // sockets for this user in this session
          let otherSocketsForUser = false;
          for (const userData of users.values()) {
            if (userData.id === user.id) {
              otherSocketsForUser = true;
              break;
            }
          }

          if (!otherSocketsForUser) {
            const userSessionKey = `${user.id}:${currentSessionId}`;
            activeUserSessions.delete(userSessionKey);
          }

          // If there are no more users in the session, clean up
          if (users.size === 0) {
            activeUsers.delete(currentSessionId);
          } else {
            // Notify remaining users
            const sessionUsers = Array.from(users.values());
            io.to(currentSessionId).emit("users-update", sessionUsers);
          }
        }
      }

      // Clear current user and session
      currentUser = null;
      currentSessionId = null;
    });

    // Handle collaboration joined events (for metrics)
    socket.on("collaboration-joined", async (data) => {
      const { sessionId, ownerId, collaboratorId, collaboratorName } = data;
      console.log(
        `Collaboration event: ${
          collaboratorName || collaboratorId
        } joined ${ownerId}'s session ${sessionId}`
      );

      try {
        // Get the socket ID for the session owner
        const ownerSocketId = await getSocketIdForUser(ownerId);

        if (ownerSocketId) {
          // Forward the event to the session owner
          io.to(ownerSocketId).emit("collaboration-joined", data);
          console.log(
            `Forwarded collaboration event to session owner ${ownerId}`
          );
        } else {
          console.log(`Could not find socket for owner ${ownerId}`);
        }
      } catch (error) {
        console.error("Error handling collaboration-joined event:", error);
      }
    });

    // Find user socket helper for client
    socket.on("find-user-socket", (data, callback) => {
      const { userId } = data;

      if (!userId) {
        if (callback) callback({ error: "User ID is required" });
        return;
      }

      try {
        // Try to find a socket for this user in any session
        let foundSocketId = null;

        // Loop through all sessions to find the user
        for (const [sessionId, users] of activeUsers.entries()) {
          for (const [socketId, userData] of users.entries()) {
            if (userData.id === userId) {
              foundSocketId = socketId;
              break;
            }
          }
          if (foundSocketId) break;
        }

        if (callback) {
          callback({
            socketId: foundSocketId,
            success: !!foundSocketId,
          });
        }
      } catch (error) {
        console.error("Error finding user socket:", error);
        if (callback) callback({ error: "Failed to find user socket" });
      }
    });

    // Helper function to get socket ID for a user
    const getSocketIdForUser = async (userId) => {
      // Quick search in current session first
      if (currentSessionId && activeUsers.has(currentSessionId)) {
        const users = activeUsers.get(currentSessionId);
        for (const [socketId, userData] of users.entries()) {
          if (userData.id === userId) {
            return socketId;
          }
        }
      }

      // If not found, search all sessions
      for (const [sessionId, users] of activeUsers.entries()) {
        for (const [socketId, userData] of users.entries()) {
          if (userData.id === userId) {
            return socketId;
          }
        }
      }

      return null;
    };

    // Handle get-users request
    socket.on("get-users", ({ sessionId }) => {
      if (!sessionId) {
        socket.emit("error", { message: "Session ID is required" });
        return;
      }

      console.log(`${socket.id} requested users for session ${sessionId}`);

      if (activeUsers.has(sessionId)) {
        const users = activeUsers.get(sessionId);

        // Convert to array for response
        const usersList = Array.from(users.values());

        console.log(
          `Sending ${usersList.length} users for session ${sessionId}`
        );

        // Emit to the requesting socket
        socket.emit("users-update", usersList);

        // Also broadcast to all other users in the session to ensure everyone has current list
        socket.to(sessionId).emit("users-update", usersList);
      } else {
        console.log(`No users found for session ${sessionId}`);
        socket.emit("users-update", []);
      }
    });

    // Handle peer connection requests
    socket.on("request-peer-connections", (data) => {
      if (!data.sessionId || !data.userId || !data.peerId) {
        socket.emit("error", {
          message: "Invalid peer connection request data",
        });
        return;
      }

      console.log(
        `User ${data.userId} requesting peer connections in session ${data.sessionId}`
      );

      // Broadcast to everyone in the session except the sender
      socket.to(data.sessionId).emit("request-peer-connections", data);
    });

    // Handle force-exit-session (direct notification from owner to participants)
    socket.on("force-exit-session", (data) => {
      try {
        const { sessionId, message, endedBy } = data;

        if (!sessionId) {
          socket.emit("error", { message: "Session ID is required" });
          return;
        }

        console.log(
          `User ${endedBy} forcing participants to exit session ${sessionId}`
        );

        // Broadcast to all users in the session except the sender
        socket.to(sessionId).emit("force-exit-session", {
          sessionId,
          message: message || "Session has been ended by the owner",
          endedBy,
        });

        console.log(
          `Force-exit-session event broadcast to session ${sessionId}`
        );
      } catch (error) {
        console.error("Error broadcasting force-exit-session:", error);
      }
    });
  });

  // Helper function to update session code in the database (with debounce)
  const sessionUpdateTimers = {};
  const updateSessionCode = (sessionId, code) => {
    // Clear any existing timer for this session
    if (sessionUpdateTimers[sessionId]) {
      clearTimeout(sessionUpdateTimers[sessionId]);
    }

    // Set a new timer to update after 2 seconds of inactivity
    sessionUpdateTimers[sessionId] = setTimeout(async () => {
      try {
        await db.collection("sessions").doc(sessionId).update({
          code,
          updatedAt: new Date(),
        });
        console.log(`Session ${sessionId} code updated in database`);
      } catch (error) {
        console.error(`Failed to update session ${sessionId} code:`, error);
      }
    }, 2000);
  };
};

module.exports = { setupSocketHandlers };
