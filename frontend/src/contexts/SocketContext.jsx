import { createContext, useContext, useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

// Global socket instance that persists across component unmounts
let sharedSocketInstance = null;

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(sharedSocketInstance);
  const [connected, setConnected] = useState(
    sharedSocketInstance?.connected || false
  );
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const authenticatedRef = useRef(false);
  const initializingRef = useRef(false);

  useEffect(() => {
    // Use existing shared socket if already connected
    if (sharedSocketInstance?.connected) {
      setSocket(sharedSocketInstance);
      setConnected(true);
      return;
    }

    // Prevent multiple initialization attempts or too many reconnection attempts
    if (initializingRef.current || connectionAttempts > 5) {
      if (connectionAttempts > 5) {
        console.warn(
          "Too many socket connection attempts, stopping reconnection"
        );
      }
      return;
    }

    // Mark as initializing to prevent duplicate attempts
    initializingRef.current = true;

    // Determine server URL based on environment
    const serverUrl =
      import.meta.env.MODE === "development"
        ? import.meta.env.VITE_API_URL || "http://localhost:3001"
        : import.meta.env.VITE_PRODUCTION_API_URL ||
          "https://codecolab-852p.onrender.com";

    if (!sharedSocketInstance) {
      console.log(
        `Socket.IO connection attempt ${connectionAttempts + 1} to ${serverUrl}`
      );
    }

    // Create socket connection - ONLY use polling to avoid WebSocket issues
    const socketInstance =
      sharedSocketInstance ||
      io(serverUrl, {
        transports: ["polling"],
        upgrade: false,
        rememberUpgrade: false,
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000,
        withCredentials: true,
      });

    // Store in global reference
    sharedSocketInstance = socketInstance;

    // Set up event listeners
    const handleConnect = () => {
      console.log("Socket connected:", socketInstance.id);
      setConnected(true);
      setConnectionAttempts(0);
      authenticatedRef.current = false;
      initializingRef.current = false;
    };

    const handleDisconnect = () => {
      console.log("Socket disconnected");
      setConnected(false);
      initializingRef.current = false;
    };

    const handleError = (error) => {
      console.error("Socket connection error:", error);
      setConnected(false);
      setConnectionAttempts((prev) => prev + 1);
      initializingRef.current = false;
    };

    const handleJoinedSession = () => {
      console.log("Successfully joined session, marking as authenticated");
      authenticatedRef.current = true;
    };

    // Add event listeners - but only if they're not already attached
    if (!socketInstance._hasRegisteredHandlers) {
      socketInstance.on("connect", handleConnect);
      socketInstance.on("disconnect", handleDisconnect);
      socketInstance.on("connect_error", handleError);
      socketInstance.on("joined-session", handleJoinedSession);
      socketInstance._hasRegisteredHandlers = true;
    }

    // Trigger connect handler if already connected
    if (socketInstance.connected) {
      handleConnect();
    }

    // Set socket in state
    setSocket(socketInstance);

    // Cleanup on unmount
    return () => {
      initializingRef.current = false;
    };
  }, [connectionAttempts]);

  // Authenticate with server
  const authenticate = (data) => {
    if (!socket || !connected || authenticatedRef.current) return;
    console.log("Emitting authenticate event");
    socket.emit("authenticate", data);
  };

  // Check if authenticated
  const isAuthenticated = () => authenticatedRef.current;

  // Request users list
  const requestUsersList = (sessionId) => {
    if (!socket || !connected) return false;
    console.log("Requesting users list for session:", sessionId);
    socket.emit("get-users", { sessionId });
    return true;
  };

  // Find socket ID for a specific user
  const findUserSocketId = (userId) => {
    if (!socket) return null;

    // Request this information from the server
    return new Promise((resolve) => {
      socket.emit("find-user-socket", { userId }, (response) => {
        if (response && response.socketId) {
          resolve(response.socketId);
        } else {
          resolve(null);
        }
      });
    });
  };

  const value = {
    socket,
    connected,
    authenticate,
    requestUsersList,
    isAuthenticated,
    authenticatedRef,
    findUserSocketId,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};

export default SocketContext;
