import { useEffect, useRef, useState } from "react";
import Peer from "peerjs";
import { useSocket } from "../contexts/SocketContext";
import { useAuth } from "../contexts/AuthContext";
import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
  FaExpand,
  FaCompress,
} from "react-icons/fa";
import { IoClose } from "react-icons/io5";
import "../styles/components/VideoChat.css";

// Store whether local PeerJS server was already checked
let localPeerJSServerChecked = false;
let localPeerJSServerAvailable = false;

// Global key for localStorage
const VIDEO_CHAT_KEY = "codecolab_video_chat_active";

const VideoChat = ({ sessionId, participants, onClose }) => {
  const { socket, connected } = useSocket();
  const { currentUser } = useAuth();
  const [peers, setPeers] = useState({});
  const [streams, setStreams] = useState({});
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState(null);
  const [connecting, setConnecting] = useState(true);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const myStream = useRef(null);
  const myPeer = useRef(null);
  const myPeerId = useRef(null);
  const videoRefs = useRef({});
  const activeConnections = useRef(new Set());

  // Save video chat state to localStorage on mount
  useEffect(() => {
    if (sessionId && sessionId !== "new") {
      // Store active video chat session id in localStorage
      localStorage.setItem(VIDEO_CHAT_KEY, sessionId);

      // Clean up on unmount
      return () => {
        // Only remove if this is the current active session
        // This prevents a new session from removing the localStorage value
        // when the component is unmounting during navigation
        if (localStorage.getItem(VIDEO_CHAT_KEY) === sessionId) {
          // Don't remove when switching views - check the URL to determine
          // if we're still in the same session just different view
          const currentPath = window.location.pathname;
          const isStillInSession =
            currentPath.includes(`/session/${sessionId}`) ||
            currentPath.includes(`/whiteboard/${sessionId}`);

          if (!isStillInSession) {
            localStorage.removeItem(VIDEO_CHAT_KEY);
          }
        }
      };
    }
  }, [sessionId]);

  // Initialize peer connection
  useEffect(() => {
    if (!sessionId || !currentUser || !socket || !connected) return;

    let reconnectTimer = null;

    const initPeer = async () => {
      try {
        setConnecting(true);

        // Clean up any existing peer connection
        if (myPeer.current) {
          myPeer.current.destroy();
          // Clear active connections tracking
          activeConnections.current.clear();
        }

        // Configure PeerJS with reliable options
        const peerOptions = {
          debug: 1, // Reduce log level (0-3)
          config: {
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: "stun:stun1.l.google.com:19302" },
              { urls: "stun:stun2.l.google.com:19302" },
            ],
            sdpSemantics: "unified-plan",
          },
        };

        // Only check local server once during the session
        if (!localPeerJSServerChecked) {
          try {
            const checkLocalPeerJS = await fetch("http://localhost:9000", {
              signal: AbortSignal.timeout(1000),
            });
            localPeerJSServerAvailable = true;
            console.log("Local PeerJS server available");
          } catch (e) {
            localPeerJSServerAvailable = false;
            console.log(
              "Local PeerJS server not available, using cloud server"
            );
          } finally {
            localPeerJSServerChecked = true;
          }
        }

        // Use local server if available, otherwise use cloud server
        if (localPeerJSServerAvailable) {
          peerOptions.host = "localhost";
          peerOptions.port = 9000;
          peerOptions.path = "/peerjs";
          peerOptions.secure = false;
        }

        // Create new peer with unique ID based on user ID and session
        const randomId = Math.random().toString(36).substring(2, 8);
        const peer = new Peer(
          `${currentUser.uid}-${sessionId}-${randomId}`,
          peerOptions
        );
        myPeer.current = peer;

        // Handle peer open event (successfully connected to signaling server)
        peer.on("open", (id) => {
          console.log("My peer ID is:", id);
          myPeerId.current = id;
          setConnecting(false);
          setError(null);

          // Notify other users about my peer ID
          socket.emit("peer-joined", {
            sessionId,
            peerId: id,
            userId: currentUser.uid,
          });

          // Request current participants to connect
          console.log("Requesting peer connections from existing participants");
          socket.emit("request-peer-connections", {
            sessionId,
            userId: currentUser.uid,
            peerId: id,
          });
        });

        // Handle peer connection errors
        peer.on("error", (err) => {
          console.error("PeerJS error:", err);

          // Handle specific error types
          if (err.type === "peer-unavailable") {
            console.log("Peer unavailable, they may have left");
          } else if (
            err.type === "network" ||
            err.type === "disconnected" ||
            err.type === "server-error"
          ) {
            setError(
              `Connection error: ${err.type}. Attempting to reconnect...`
            );

            // Clear any existing reconnect timers
            if (reconnectTimer) clearTimeout(reconnectTimer);

            // Set a reconnect timer with exponential backoff
            const backoffTime = Math.min(
              1000 * Math.pow(2, reconnectAttempt),
              30000
            );
            reconnectTimer = setTimeout(() => {
              setReconnectAttempt((prev) => prev + 1);
            }, backoffTime);
          } else {
            setError(`Connection error: ${err.type}`);
          }
        });

        // Setup media streams
        await setupMediaStream();

        // Handle incoming calls
        peer.on("call", async (call) => {
          // Extract userId from peer ID by taking only the first segment
          const callerId = call.peer.split("-")[0];

          // Check if we already have a connection with this user
          const peerKey = call.peer;
          if (activeConnections.current.has(callerId)) {
            console.log(
              `Already have a connection with ${callerId}, ignoring duplicate call`
            );
            return;
          }

          console.log("Receiving call from:", callerId);

          // Ensure we have a media stream before answering
          if (!myStream.current) {
            try {
              await setupMediaStream();
            } catch (err) {
              console.error("Failed to setup media for incoming call:", err);
            }
          }

          // Mark as connected to this user
          activeConnections.current.add(callerId);

          // Answer the call with our stream
          if (myStream.current) {
            call.answer(myStream.current);
          } else {
            console.warn("No local stream available to answer call");
            call.answer(); // Answer with no stream
          }

          // Handle incoming stream
          call.on("stream", (remoteStream) => {
            // Only add stream if we don't already have it
            if (!streams[callerId]) {
              console.log("Received stream from:", callerId);
              setStreams((prev) => ({ ...prev, [callerId]: remoteStream }));
            }
          });

          // Handle call close
          call.on("close", () => {
            console.log("Call closed with:", callerId);

            // Remove from active connections
            activeConnections.current.delete(callerId);

            setStreams((prev) => {
              const newStreams = { ...prev };
              delete newStreams[callerId];
              return newStreams;
            });
          });

          // Save the call reference
          setPeers((prev) => ({ ...prev, [peerKey]: call }));
        });

        // Listen for peer events from socket
        socket.on("peer-joined", (data) => {
          if (data.userId !== currentUser.uid && data.sessionId === sessionId) {
            console.log("New peer joined, connecting to:", data.userId);
            connectToPeer(data.peerId, data.userId);
          }
        });

        socket.on("request-peer-connections", (data) => {
          if (
            data.userId !== currentUser.uid &&
            data.sessionId === sessionId &&
            myPeer.current
          ) {
            console.log("Received request to connect from:", data.userId);
            connectToPeer(data.peerId, data.userId);
          }
        });

        // Clean up peers when users leave
        socket.on("peer-left", (data) => {
          if (data.sessionId === sessionId) {
            console.log("Peer left:", data.userId);

            // Remove from active connections
            activeConnections.current.delete(data.userId);

            // Close any active peer connections to this user
            for (const [peerKey, call] of Object.entries(peers)) {
              if (peerKey.startsWith(data.userId + "-")) {
                call.close();
                setPeers((prev) => {
                  const newPeers = { ...prev };
                  delete newPeers[peerKey];
                  return newPeers;
                });
              }
            }

            // Remove streams
            setStreams((prev) => {
              const newStreams = { ...prev };
              delete newStreams[data.userId];
              return newStreams;
            });
          }
        });
      } catch (err) {
        console.error("Error initializing peer:", err);
        setError(`Setup error: ${err.message}`);
        setConnecting(false);
      }
    };

    const setupMediaStream = async () => {
      try {
        // Get local media stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        myStream.current = stream;
        setStreams((prev) => ({ ...prev, [currentUser.uid]: stream }));
        return true;
      } catch (mediaError) {
        console.error("Media access error:", mediaError);
        setError(`Could not access camera/microphone: ${mediaError.message}`);

        // Try fallback to just audio if video fails
        try {
          const audioOnlyStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true,
          });
          myStream.current = audioOnlyStream;
          setStreams((prev) => ({
            ...prev,
            [currentUser.uid]: audioOnlyStream,
          }));
          setIsVideoEnabled(false);
          return true;
        } catch (audioError) {
          console.error("Audio-only fallback failed:", audioError);
          setError("Could not access audio. Please check your permissions.");
          return false;
        }
      }
    };

    // Initialize peer when component mounts
    initPeer();

    // Reinitialize peer when reconnect attempt changes
    if (reconnectAttempt > 0) {
      console.log(`Reconnection attempt #${reconnectAttempt}`);
      initPeer();
    }

    return () => {
      // Clean up
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }

      if (myStream.current) {
        myStream.current.getTracks().forEach((track) => track.stop());
      }

      if (myPeer.current) {
        myPeer.current.destroy();
      }

      if (socket) {
        socket.off("peer-joined");
        socket.off("peer-left");
        socket.off("request-peer-connections");

        // Notify others that I'm leaving
        if (myPeerId.current) {
          socket.emit("peer-left", {
            sessionId,
            peerId: myPeerId.current,
            userId: currentUser.uid,
          });
        }
      }

      // Clear connection tracking
      activeConnections.current.clear();
    };
  }, [sessionId, currentUser, socket, connected, reconnectAttempt]);

  // Connect to another peer
  const connectToPeer = (peerId, userId) => {
    if (!myPeer.current || !myStream.current) {
      console.warn("Cannot connect: Peer or Stream not initialized");
      return;
    }

    // Don't reconnect if already connected to this user
    if (activeConnections.current.has(userId)) {
      console.log("Already connected to user:", userId);
      return;
    }

    console.log("Calling peer:", peerId, "for user:", userId);

    try {
      // Mark as connected to this user
      activeConnections.current.add(userId);

      const call = myPeer.current.call(peerId, myStream.current);

      call.on("stream", (remoteStream) => {
        // Only add stream if we don't already have it
        if (!streams[userId]) {
          console.log("Received stream from call to:", userId);
          setStreams((prev) => ({ ...prev, [userId]: remoteStream }));
        }
      });

      call.on("error", (err) => {
        console.error("Call error:", err);
        // Remove from active connections on error
        activeConnections.current.delete(userId);
      });

      call.on("close", () => {
        console.log("Call closed with:", userId);
        activeConnections.current.delete(userId);

        setStreams((prev) => {
          const newStreams = { ...prev };
          delete newStreams[userId];
          return newStreams;
        });
      });

      setPeers((prev) => ({ ...prev, [peerId]: call }));
    } catch (err) {
      console.error("Error calling peer:", err);
      // Remove from active connections on error
      activeConnections.current.delete(userId);
    }
  };

  // Toggle audio
  const toggleAudio = () => {
    if (myStream.current) {
      const audioTracks = myStream.current.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks.forEach((track) => {
          track.enabled = !isAudioEnabled;
        });
        setIsAudioEnabled(!isAudioEnabled);
      }
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (myStream.current) {
      const videoTracks = myStream.current.getVideoTracks();
      if (videoTracks.length > 0) {
        videoTracks.forEach((track) => {
          track.enabled = !isVideoEnabled;
        });
        setIsVideoEnabled(!isVideoEnabled);
      }
    }
  };

  // Toggle expanded view
  const toggleExpand = () => {
    setExpanded(!expanded);
  };

  // Handle video setup
  const handleVideoRef = (element, userId) => {
    if (element && streams[userId]) {
      // Only set srcObject if it has changed
      if (element.srcObject !== streams[userId]) {
        element.srcObject = streams[userId];
        // Use play() with promise handling to avoid errors
        element.play().catch((e) => {
          // Don't log AbortError as it's expected when components unmount
          if (e.name !== "AbortError") {
            console.error("Error playing video:", e);
          }
        });
      }
      videoRefs.current[userId] = element;
    }
  };

  // Find participant name by user ID
  const getParticipantName = (userId) => {
    const participant = participants.find((p) => p.id === userId);
    return participant?.name || "Unknown";
  };

  // Count participants
  const participantCount = Object.keys(streams).length;

  // Custom close handler that updates localStorage
  const handleCloseChat = () => {
    // Remove active chat from localStorage
    localStorage.removeItem(VIDEO_CHAT_KEY);

    // Call the onClose handler provided by parent
    if (onClose) onClose();
  };

  return (
    <div className={`video-chat-container ${expanded ? "expanded" : ""}`}>
      <div className="video-chat-header">
        <h3>
          Video Chat {participantCount > 0 ? `(${participantCount})` : ""}
        </h3>
        <div className="video-chat-controls">
          <button
            onClick={toggleExpand}
            className="control-button"
            title={expanded ? "Minimize" : "Expand"}
          >
            {expanded ? <FaCompress /> : <FaExpand />}
          </button>
          <button
            onClick={handleCloseChat}
            className="control-button close"
            title="Close"
          >
            <IoClose />
          </button>
        </div>
      </div>

      {error && (
        <div className="video-chat-error">
          <p>{error}</p>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {connecting && (
        <div className="video-chat-connecting">
          <p>Connecting to peers...</p>
          <div className="connecting-spinner"></div>
        </div>
      )}

      <div className="videos-grid">
        {Object.entries(streams).length > 0 ? (
          Object.entries(streams).map(([userId, stream]) => (
            <div
              key={userId}
              className={`video-item ${
                userId === currentUser.uid ? "my-video" : ""
              }`}
            >
              <video
                ref={(el) => handleVideoRef(el, userId)}
                muted={userId === currentUser.uid}
                autoPlay
                playsInline
              />
              <div className="video-chat-participant-info">
                <span className="video-chat-participant-name">
                  {getParticipantName(userId)}
                </span>
                {userId === currentUser.uid && (
                  <div className="media-indicators">
                    {!isAudioEnabled && (
                      <FaMicrophoneSlash className="media-off" />
                    )}
                    {!isVideoEnabled && <FaVideoSlash className="media-off" />}
                  </div>
                )}
              </div>
            </div>
          ))
        ) : connecting ? (
          <div className="empty-state">
            <p>Initializing video connection...</p>
          </div>
        ) : (
          <div className="no-streams">
            <p>No video streams available</p>
            <p className="subtext">
              You'll see participants here when they join
            </p>
            {reconnectAttempt > 0 && (
              <button
                onClick={() => setReconnectAttempt((prev) => prev + 1)}
                className="reconnect-button"
              >
                Retry Connection
              </button>
            )}
          </div>
        )}
      </div>

      <div className="video-controls">
        <button
          onClick={toggleAudio}
          className={`control-btn ${!isAudioEnabled ? "disabled" : ""}`}
          title={isAudioEnabled ? "Mute microphone" : "Unmute microphone"}
        >
          {isAudioEnabled ? <FaMicrophone /> : <FaMicrophoneSlash />}
        </button>
        <button
          onClick={toggleVideo}
          className={`control-btn ${!isVideoEnabled ? "disabled" : ""}`}
          title={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
        >
          {isVideoEnabled ? <FaVideo /> : <FaVideoSlash />}
        </button>
      </div>
    </div>
  );
};

// Export a helper function to check if video chat is active for a sessionId
export const isVideoChatActive = (sessionId) => {
  return localStorage.getItem(VIDEO_CHAT_KEY) === sessionId;
};

// Export a helper to set video chat as active
export const setVideoChatActive = (sessionId) => {
  if (sessionId && sessionId !== "new") {
    localStorage.setItem(VIDEO_CHAT_KEY, sessionId);
    return true;
  }
  return false;
};

export default VideoChat;
