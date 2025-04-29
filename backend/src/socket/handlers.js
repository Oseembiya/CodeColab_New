const { db } = require("../config/firebase");

// Socket event handlers
const setupSocketHandlers = (io) => {
  // Active users in each session
  const activeUsers = new Map();

  // Active user-session pairs to prevent duplicate joins
  const activeUserSessions = new Set();

  // Track authentication attempts to prevent spamming
  const authAttempts = new Map();

  // For tracking media status
  const userMediaStatus = new Map();

  // Reference to platform metrics in Firestore
  const platformMetricsRef = db.collection("platformMetrics").doc("global");

  // Global stats tracker
  let globalStats = {
    activeSessions: 0,
    collaboratingUsers: 0,
    totalLinesOfCode: 0,
    lastUpdated: new Date(),
  };

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
        console.log("Loaded platform metrics from Firestore:", globalStats);
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
      .then(() => console.log("Platform metrics saved to Firestore"))
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

    db.collection("platformMetricsHistory")
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
    console.log("User connected:", socket.id);
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

        // Initialize media status
        if (!userMediaStatus.has(user.uid)) {
          userMediaStatus.set(user.uid, {
            audioEnabled: true,
            videoEnabled: true,
          });
        }

        // Notify all users in the session about the updated user list
        const sessionUsers = Array.from(
          activeUsers.get(sessionId).values()
        ).map((user) => ({
          ...user,
          ...userMediaStatus.get(user.id),
        }));

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

          // Also remove media status
          if (userMediaStatus.has(removedUser.id)) {
            userMediaStatus.delete(removedUser.id);
          }

          // Notify remaining users about user list change
          const sessionUsers = Array.from(users.values()).map((user) => ({
            ...user,
            ...userMediaStatus.get(user.id),
          }));

          console.log(
            `Emitting updated users (${sessionUsers.length}) after user left`
          );
          io.to(sessionId).emit("users-update", sessionUsers);

          // Also emit video left event if needed
          io.to(sessionId).emit("video-user-left", {
            userId: removedUser.id,
          });
        }
      }

      // If this was the current session for this socket, clear it
      if (currentSessionId === sessionId) {
        currentSessionId = null;
      }
    });

    // Handle video chat join
    socket.on("video-join", (data) => {
      const { sessionId, userId, peerId } = data;

      if (!sessionId || !userId) {
        socket.emit("error", {
          message: "Session ID and user ID are required",
        });
        return;
      }

      console.log(
        `User ${userId} joining video chat in session ${sessionId} with peer ID ${peerId}`
      );

      // Update user's hasVideo status and media status
      if (activeUsers.has(sessionId)) {
        const users = activeUsers.get(sessionId);
        let userUpdated = false;

        // Find and mark the user as having video
        for (const [socketId, userData] of users.entries()) {
          if (userData.id === userId) {
            userData.hasVideo = true;
            userData.peerId = peerId; // Store the peer ID
            userUpdated = true;
            console.log(
              `Updated user ${userId} to have video in session ${sessionId} with peerId ${peerId}`
            );
            break;
          }
        }

        // Initialize media status if not already set
        if (!userMediaStatus.has(userId)) {
          userMediaStatus.set(userId, {
            audioEnabled: true,
            videoEnabled: true,
          });
          console.log(
            `Initialized media status for user ${userId} in session ${sessionId}`
          );
        }

        // If user was updated, emit updated user list
        if (userUpdated) {
          const sessionUsers = Array.from(users.values()).map((user) => ({
            ...user,
            ...userMediaStatus.get(user.id),
          }));

          console.log(
            `Emitting updated users (${sessionUsers.length}) after video join`
          );
          io.to(sessionId).emit("users-update", sessionUsers);
        }

        // Get all users with video in this session to notify the new user
        const usersWithVideo = [];
        for (const [, userData] of users.entries()) {
          if (userData.id !== userId && userData.hasVideo && userData.peerId) {
            usersWithVideo.push({
              userId: userData.id,
              peerId: userData.peerId,
            });
          }
        }

        // Send existing video users to the new user first
        if (usersWithVideo.length > 0) {
          console.log(
            `Sending ${usersWithVideo.length} existing video users to ${userId}`
          );
          for (const videoUser of usersWithVideo) {
            socket.emit("video-user-joined", videoUser);
          }
        }
      }

      // Broadcast to all users in the session that this user has joined video
      socket.to(sessionId).emit("video-user-joined", {
        userId,
        peerId,
      });

      console.log(
        `User ${userId} joined video chat in session ${sessionId} with peer ID ${peerId}`
      );
    });

    // Handle video user leaving explicitly (different from disconnect)
    socket.on("video-user-left", (data) => {
      const { sessionId, userId } = data;

      if (!sessionId || !userId) {
        return;
      }

      console.log(
        `User ${userId} explicitly left video in session ${sessionId}`
      );

      // Update user's video status in active users
      if (activeUsers.has(sessionId)) {
        const users = activeUsers.get(sessionId);

        // Find user and update their video status
        for (const [socketId, userData] of users.entries()) {
          if (userData.id === userId) {
            userData.hasVideo = false;
            delete userData.peerId;
            break;
          }
        }

        // Notify all users in the session
        io.to(sessionId).emit("video-user-left", { userId });

        // Also update the users list
        const sessionUsers = Array.from(users.values()).map((user) => ({
          ...user,
          ...userMediaStatus.get(user.id),
        }));

        io.to(sessionId).emit("users-update", sessionUsers);
      }
    });

    // Handle media status updates
    socket.on("media-status-update", (data) => {
      const { sessionId, audioEnabled, videoEnabled } = data;

      if (!currentUser || !sessionId) {
        socket.emit("error", { message: "You must join a session first" });
        return;
      }

      console.log(
        `Media status update for user ${currentUser.uid} in session ${sessionId}: audio=${audioEnabled}, video=${videoEnabled}`
      );

      // Update media status
      userMediaStatus.set(currentUser.uid, {
        audioEnabled,
        videoEnabled,
      });

      // Get user data
      if (activeUsers.has(sessionId)) {
        const users = activeUsers.get(sessionId);
        const sessionUsers = Array.from(users.values()).map((user) => ({
          ...user,
          ...userMediaStatus.get(user.id),
        }));

        // Broadcast updated user list to everyone in the session
        console.log(
          `Emitting updated users (${sessionUsers.length}) after media status update`
        );
        io.to(sessionId).emit("users-update", sessionUsers);
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

      // If this is a challenge code update, preserve that metadata
      if (data.fromChallenge) {
        console.log(
          `Relaying challenge code update for challenge ${data.challengeId}`
        );
      }

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

      console.log(
        `Received whiteboard-draw from user ${currentUser?.uid} in session ${currentSessionId}`
      );

      // Broadcast to everyone in the session except the sender
      socket.to(currentSessionId).emit("whiteboard-draw", enrichedData);
    });

    // Handle whiteboard clear
    socket.on("whiteboard-clear", (data) => {
      if (!currentSessionId) {
        socket.emit("error", { message: "You must join a session first" });
        return;
      }

      console.log(
        `Received whiteboard-clear from user ${currentUser?.uid} in session ${currentSessionId}`
      );

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
      socket.to(currentSessionId).emit("whiteboard-clear", enrichedData);
    });

    // Handle challenge selection
    socket.on("challenge-selected", (data) => {
      if (!currentSessionId) {
        socket.emit("error", { message: "You must join a session first" });
        return;
      }

      console.log(
        `Received challenge-selected from user ${currentUser?.uid} in session ${currentSessionId}`
      );

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

      console.log(
        `Received challenge-closed from user ${currentUser?.uid} in session ${currentSessionId}`
      );

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

      // Broadcast to everyone in the session except the sender
      socket.to(currentSessionId).emit("whiteboard-update", enrichedData);
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
      console.log("User disconnected:", socket.id);

      if (currentSessionId && activeUsers.has(currentSessionId)) {
        const users = activeUsers.get(currentSessionId);
        const user = Array.from(users.values()).find(
          (u) => u.socketId === socket.id
        );

        // Only remove if we found the user
        if (user) {
          console.log(
            `User ${user.id} disconnected from session ${currentSessionId}`
          );

          // Remove user from active users
          users.delete(socket.id);

          // Clean up user session tracking - but only if there are no other
          // sockets for this user in this session
          let otherSocketsForUser = false;
          for (const userData of users.values()) {
            if (userData.id === user.id) {
              otherSocketsForUser = true;
              console.log(
                `User ${user.id} still has other active connections in session ${currentSessionId}`
              );
              break;
            }
          }

          if (!otherSocketsForUser && currentUser) {
            const userSessionKey = `${user.id}:${currentSessionId}`;
            console.log(`Removing user-session pair: ${userSessionKey}`);
            activeUserSessions.delete(userSessionKey);

            // Also clean up media status if no other connections
            if (userMediaStatus.has(user.id)) {
              userMediaStatus.delete(user.id);
            }
          }

          // If there are no more users in the session, clean up
          if (users.size === 0) {
            console.log(
              `No more users in session ${currentSessionId}, cleaning up`
            );
            activeUsers.delete(currentSessionId);
          } else {
            // Notify remaining users
            const sessionUsers = Array.from(users.values()).map((user) => ({
              ...user,
              ...userMediaStatus.get(user.id),
            }));

            io.to(currentSessionId).emit("users-update", sessionUsers);

            // Notify about video chat disconnect
            if (user && user.id) {
              io.to(currentSessionId).emit("video-user-left", {
                userId: user.id,
              });
            }
          }
        } else {
          console.log(
            `Socket ${socket.id} not found in session ${currentSessionId}`
          );
        }
      } else {
        console.log(`Socket ${socket.id} not associated with any session`);
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
        const usersList = Array.from(users.values()).map((user) => ({
          ...user,
          ...(userMediaStatus.get(user.id) || {
            audioEnabled: true,
            videoEnabled: true,
          }),
        }));

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
