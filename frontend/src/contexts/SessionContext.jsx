import { createContext, useContext, useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { useAuth } from "./AuthContext";
import { useUserMetrics } from "./UserMetricsContext";
import { useSocket } from "./SocketContext";
import axios from "axios";

// Define base API URL - use environment variable based on mode
const baseUrl =
  import.meta.env.MODE === "development"
    ? import.meta.env.VITE_API_URL || "http://localhost:3001"
    : import.meta.env.VITE_PRODUCTION_API_URL || "";

// Use relative API URL with proxy instead of full URL
// const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

const SessionContext = createContext();

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
};

export const SessionProvider = ({ children }) => {
  const [sessions, setSessions] = useState([]); // User's personal sessions
  const [publicSessions, setPublicSessions] = useState([]); // All sessions (was public only)
  const [currentSession, setCurrentSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [publicSessionsLoading, setPublicSessionsLoading] = useState(true);
  // Add session code state to store code content between view switches
  const [sessionCodeState, setSessionCodeState] = useState({});
  const { currentUser } = useAuth();
  const metrics = useUserMetrics();
  const { socket } = useSocket();

  // Update session code in state when it changes
  const updateSessionCode = (sessionId, code, language = "javascript") => {
    if (!sessionId || sessionId === "new") return;

    setSessionCodeState((prevState) => ({
      ...prevState,
      [sessionId]: {
        code,
        language,
        lastUpdated: new Date(),
      },
    }));
  };

  // Get current code for a session
  const getSessionCode = (sessionId) => {
    if (!sessionId || !sessionCodeState[sessionId]) {
      return {
        code: "// Start coding here\n\n",
        language: "javascript",
      };
    }

    return sessionCodeState[sessionId];
  };

  // Fetch user's sessions
  useEffect(() => {
    const fetchSessions = async () => {
      if (!currentUser) {
        setSessions([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const token = await currentUser.getIdToken();
        const apiUrl = `${baseUrl}/api/sessions`.replace(/\/\/api/, "/api");
        const response = await axios.get(apiUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.data.status === "success") {
          setSessions(response.data.data);
        }
      } catch (error) {
        console.error("Error fetching sessions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [currentUser]);

  // Fetch all sessions (previously only public sessions)
  useEffect(() => {
    const fetchAllSessions = async () => {
      try {
        setPublicSessionsLoading(true);
        // Always use the absolute URL to avoid requesting from the frontend domain
        // Make sure baseUrl is included even when the path starts with "/"
        const apiUrl = `${baseUrl}/api/sessions/all`.replace(/\/\/api/, "/api");
        const response = await axios.get(apiUrl);

        if (response.data.status === "success") {
          setPublicSessions(response.data.data);
        } else {
          console.error("Server returned error status:", response.data);
        }
      } catch (error) {
        console.error("Error fetching all sessions:", error);
        if (error.response) {
          console.error("Response status:", error.response.status);
          console.error("Response data:", error.response.data);
        } else if (error.request) {
          console.error("No response received:", error.request);
        } else {
          console.error("Error details:", error.message);
        }
      } finally {
        setPublicSessionsLoading(false);
      }
    };

    fetchAllSessions();

    // Set up an interval to refresh sessions periodically
    const intervalId = setInterval(fetchAllSessions, 30000); // every 30 seconds

    return () => clearInterval(intervalId);
  }, []);

  // Create a new session
  const createSession = async (sessionData) => {
    if (!currentUser) {
      throw new Error("You must be logged in to create a session");
    }

    try {
      const token = await currentUser.getIdToken();
      const apiUrl = `${baseUrl}/api/sessions`.replace(/\/\/api/, "/api");
      const response = await axios.post(
        apiUrl,
        {
          title: sessionData.title,
          language: sessionData.language,
          description: sessionData.description,
          isPublic: sessionData.isPublic,
          status: sessionData.status || "active",
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.status === "success") {
        // Add the new session to the sessions list
        setSessions((prevSessions) => [...prevSessions, response.data.data]);

        // Add to all sessions list too
        setPublicSessions((prevSessions) => [
          ...prevSessions,
          response.data.data,
        ]);

        // Update metrics - increment totalSessions
        if (metrics && metrics.incrementMetrics) {
          metrics.incrementMetrics({ totalSessions: 1 });
        }

        return response.data.data.id;
      }
    } catch (error) {
      console.error("Error creating session:", error);
      throw error;
    }
  };

  // Join an existing session
  const joinSession = async (sessionId) => {
    // If sessionId is 'new', this is standalone mode - we don't create or join any session
    if (sessionId === "new") {
      // We don't need to create or track a standalone session
      // In standalone mode, the components manage their state locally
      return null;
    }

    if (!currentUser) {
      throw new Error("You must be logged in to join a session");
    }

    try {
      const token = await currentUser.getIdToken();
      const apiUrl = `${baseUrl}/api/sessions/${sessionId}/join`.replace(
        /\/\/api/,
        "/api"
      );
      const response = await axios.post(
        apiUrl,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.status === "success") {
        // Set current session
        setCurrentSession(response.data.data);

        // Add session to user's sessions if not already there
        const sessionExists = sessions.some(
          (session) => session.id === sessionId
        );

        if (!sessionExists) {
          setSessions((prevSessions) => [...prevSessions, response.data.data]);

          // Increment collaborations metric when joining any shared session that's not your own
          // This is more reliable than checking participants array which might not be populated yet
          if (
            response.data.data &&
            response.data.data.createdBy !== currentUser.uid &&
            metrics &&
            metrics.incrementMetrics
          ) {
            console.log("Incrementing collaborations metric");
            metrics.incrementMetrics({ collaborations: 1 });

            // Notify session owner about the collaboration via socket
            if (socket && response.data.data.createdBy) {
              console.log("Emitting collaboration-joined event");
              socket.emit("collaboration-joined", {
                sessionId,
                ownerId: response.data.data.createdBy,
                collaboratorId: currentUser.uid,
                collaboratorName: currentUser.displayName || "Anonymous",
              });
            }
          }
        }

        return response.data.data;
      }
    } catch (error) {
      console.error("Error joining session:", error);
      throw error;
    }
  };

  // Leave the current session
  const leaveSession = async (clearChallenges = true) => {
    // Only update state if there is a current session to leave
    if (currentSession) {
      const sessionId = currentSession.id;
      setCurrentSession(null);

      // Optionally clear challenges from localStorage
      if (clearChallenges) {
        try {
          // Remove any stored challenges for this session
          localStorage.removeItem(`challenge_${sessionId}`);
          localStorage.removeItem(`challenge_code_${sessionId}`);
        } catch (error) {
          console.error("Error clearing challenge data:", error);
        }
      }
    }
  };

  // Refresh the sessions list (useful for manual refresh)
  const refreshSessions = async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      const token = await currentUser.getIdToken();
      const apiUrl = `${baseUrl}/api/sessions`.replace(/\/\/api/, "/api");
      const response = await axios.get(apiUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.status === "success") {
        setSessions(response.data.data);
      }
    } catch (error) {
      console.error("Error refreshing sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  // Refresh all sessions
  const refreshAllSessions = async () => {
    setPublicSessionsLoading(true);
    try {
      const apiUrl = `${baseUrl}/api/sessions/all`.replace(/\/\/api/, "/api");
      const response = await axios.get(apiUrl);

      if (response.data.status === "success") {
        setPublicSessions(response.data.data);
      }
    } catch (error) {
      console.error("Error refreshing all sessions:", error);
    } finally {
      setPublicSessionsLoading(false);
    }
  };

  // Check if we're in standalone mode
  const isStandaloneMode = (sessionId) => {
    return sessionId === "new";
  };

  const value = {
    sessions,
    publicSessions, // Now contains all sessions, not just public ones
    currentSession,
    loading,
    allSessionsLoading: publicSessionsLoading, // Renamed for clarity
    createSession,
    joinSession,
    leaveSession,
    refreshSessions,
    refreshAllSessions,
    isStandaloneMode,
    // Add the new code state functions
    updateSessionCode,
    getSessionCode,
    sessionCodeState,
  };

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
};

export default SessionContext;
