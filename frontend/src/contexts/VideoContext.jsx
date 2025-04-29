import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
} from "react";
import { useSocket } from "./SocketContext";
import { useAuth } from "./AuthContext";

const VideoContext = createContext();

export const useVideo = () => {
  const context = useContext(VideoContext);
  if (!context) {
    throw new Error("useVideo must be used within a VideoProvider");
  }
  return context;
};

export const VideoProvider = ({ children }) => {
  const { socket, connected } = useSocket();
  const { currentUser } = useAuth();

  // State for video chat
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [activeVideoSession, setActiveVideoSession] = useState(null);
  const [videoInitialized, setVideoInitialized] = useState(false);
  const [videoParticipants, setVideoParticipants] = useState([]);

  // Use refs to maintain state across re-renders
  const myStreamRef = useRef(null);
  const peerRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const peerStreamsRef = useRef({});

  // Listen for user updates to track video participants
  useEffect(() => {
    if (!socket || !connected || !activeVideoSession) return;

    const handleUsersUpdate = (users) => {
      if (!Array.isArray(users)) return;

      // Filter users who have video enabled
      const videoUsers = users.filter((user) => user.hasVideo === true);
      console.log("Received users update with video users:", videoUsers.length);

      // Update video participants
      setVideoParticipants(videoUsers);
    };

    socket.on("users-update", handleUsersUpdate);

    // Request users when first connecting
    socket.emit("get-users", { sessionId: activeVideoSession });

    return () => {
      socket.off("users-update", handleUsersUpdate);
    };
  }, [socket, connected, activeVideoSession]);

  // Open video chat for a specific session
  const openVideoChat = (sessionId) => {
    // Don't open for standalone mode
    if (!sessionId || sessionId === "new") return;

    // If switching sessions, clear old state first
    if (activeVideoSession && activeVideoSession !== sessionId) {
      console.log(
        `VideoContext: Switching session from ${activeVideoSession} to ${sessionId}, clearing state.`
      );
      clearVideoState();
    }

    setActiveVideoSession(sessionId);
    setIsVideoOpen(true);
  };

  // Close video chat panel (doesn't destroy connections)
  const closeVideoChat = () => {
    setIsVideoOpen(false);
  };

  // Store my stream
  const setMyStream = (stream) => {
    myStreamRef.current = stream;
  };

  // Store my Peer object
  const setMyPeer = (peer) => {
    if (peerRef.current && peerRef.current !== peer) {
      console.warn("VideoContext: Overwriting existing Peer object reference.");
      // Cleanup handled in the caller (VideoChat component)
    }
    peerRef.current = peer;
  };

  // Store peer connection (PeerJS Call object)
  const setPeerConnection = (userId, call) => {
    console.log(`VideoContext: Storing peer connection for ${userId}`);
    peerConnectionsRef.current[userId] = call;
  };

  // Store peer stream (MediaStream)
  const setPeerStream = (userId, stream) => {
    console.log(
      `VideoContext: Storing peer stream for ${userId} with ${
        stream.getTracks().length
      } tracks`
    );
    peerStreamsRef.current[userId] = stream;
  };

  // Remove a specific peer's connection and stream
  const removePeer = (userId) => {
    // Close connection if exists
    if (peerConnectionsRef.current[userId]) {
      try {
        console.log(`VideoContext: Closing connection for peer ${userId}`);
        peerConnectionsRef.current[userId].close();
      } catch (e) {
        console.error("Error closing peer connection:", e);
      }
      delete peerConnectionsRef.current[userId];
    }

    // Delete stream ref
    if (peerStreamsRef.current[userId]) {
      console.log(`VideoContext: Removing stream for peer ${userId}`);
      delete peerStreamsRef.current[userId];
    }

    console.log(`VideoContext: Removed peer ${userId}`);
  };

  // Clear all video state (streams, peer, connections)
  const clearVideoState = () => {
    console.log("VideoContext: Clearing all video state.");

    // Stop my stream
    if (myStreamRef.current) {
      myStreamRef.current.getTracks().forEach((track) => {
        console.log(`Stopping ${track.kind} track: ${track.label}`);
        track.stop();
      });
      myStreamRef.current = null;
    }

    // Destroy peer object
    if (peerRef.current) {
      try {
        console.log("Destroying PeerJS instance");
        peerRef.current.destroy();
      } catch (e) {
        console.error("Error destroying peer:", e);
      }
      peerRef.current = null;
    }

    // Close all peer connections
    Object.entries(peerConnectionsRef.current).forEach(([userId, call]) => {
      try {
        console.log(`Closing connection with ${userId}`);
        call.close();
      } catch (e) {
        console.error(`Error closing connection with ${userId}:`, e);
      }
    });

    // Clear connection and stream refs
    peerConnectionsRef.current = {};
    peerStreamsRef.current = {};

    // Reset state
    setVideoInitialized(false);
    setActiveVideoSession(null);
    setIsVideoOpen(false);
    setVideoParticipants([]);
  };

  // Auto-clear state if user logs out
  useEffect(() => {
    if (!currentUser) {
      clearVideoState();
    }
  }, [currentUser]);

  // Create value object with all context properties
  const value = {
    // UI State
    isVideoOpen,
    setIsVideoOpen,
    activeVideoSession,
    setActiveVideoSession,
    openVideoChat,
    closeVideoChat,
    videoParticipants,

    // Stream/Peer State
    myStreamRef,
    setMyStream,
    peerRef,
    setMyPeer,

    // Peer Connections
    peerConnectionsRef,
    setPeerConnection,
    peerStreamsRef,
    setPeerStream,
    removePeer,

    // Lifecycle
    clearVideoState,
    videoInitialized,
    setVideoInitialized,
  };

  return (
    <VideoContext.Provider value={value}>{children}</VideoContext.Provider>
  );
};

export default VideoContext;
