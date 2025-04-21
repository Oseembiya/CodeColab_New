import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useSocket } from "../contexts/SocketContext";
import { useVideo } from "../contexts/VideoContext";
import Peer from "peerjs";
import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
  FaTimes,
} from "react-icons/fa";
import "../styles/components/VideoChat.css";

const VideoChat = ({ sessionId, onClose, participants = [] }) => {
  const { currentUser } = useAuth();
  const { socket, connected } = useSocket();
  const {
    myStreamRef,
    setMyStream: updateMyStreamContext,
    peerRef,
    setMyPeer: setMyPeerContext,
    peerConnectionsRef,
    setPeerConnection,
    peerStreamsRef,
    setPeerStream,
    removePeer,
    videoInitialized,
    setVideoInitialized,
  } = useVideo();

  // Local state
  const [myStream, setMyStream] = useState(null);
  const [peersData, setPeersData] = useState({});
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isResetting, setIsResetting] = useState(false);

  // Refs
  const myVideoRef = useRef(null);
  const peerInitializedRef = useRef(false);
  const audioElementsRef = useRef({});
  const resetTimeoutRef = useRef(null);

  // Create participant list from participants prop and peer connections
  const effectiveParticipants = React.useMemo(() => {
    // Use provided participants if available
    if (participants && participants.length > 0) {
      // Log participants for debugging
      console.log("VideoChat received participants:", participants);
      return participants;
    }

    // Otherwise create from peer connections
    const peerParticipants = Object.keys(peerStreamsRef.current).map(
      (userId) => {
        return {
          id: userId,
          name: "Participant",
          isActive: true,
          audioEnabled: true,
          videoEnabled: true,
        };
      }
    );

    // Add current user
    const currentUserEntry = {
      id: currentUser.uid,
      name: currentUser.displayName || "You",
      isActive: true,
      audioEnabled,
      videoEnabled,
    };

    const combinedParticipants = [...peerParticipants];

    // Only add current user if not already in the list
    if (!combinedParticipants.some((p) => p.id === currentUser.uid)) {
      combinedParticipants.push(currentUserEntry);
    }

    return combinedParticipants;
  }, [
    participants,
    Object.keys(peerStreamsRef.current).join(","),
    currentUser,
    audioEnabled,
    videoEnabled,
  ]);

  // When participants change, log it
  useEffect(() => {
    if (participants && participants.length > 0) {
      console.log("VideoChat participants updated:", participants);
    }
  }, [participants]);

  // Sync stream state with context
  useEffect(() => {
    if (myStreamRef.current && !myStream) {
      setMyStream(myStreamRef.current);
    } else if (!myStreamRef.current && myStream) {
      updateMyStreamContext(myStream);
    }

    // Attach local video stream
    if (myStream && myVideoRef.current) {
      if (myVideoRef.current.srcObject !== myStream) {
        myVideoRef.current.srcObject = myStream;
        myVideoRef.current
          .play()
          .catch((e) => console.warn("Video play error:", e));
      }
    }
  }, [myStreamRef.current, myStream]);

  // Sync peer data for rendering
  useEffect(() => {
    const newPeersData = {};
    Object.keys(peerStreamsRef.current).forEach((userId) => {
      newPeersData[userId] = { stream: peerStreamsRef.current[userId] };
    });

    const currentPeersStr = JSON.stringify(peersData);
    const newPeersStr = JSON.stringify(newPeersData);
    if (currentPeersStr !== newPeersStr) {
      setPeersData(newPeersData);
    }
  }, [Object.keys(peerStreamsRef.current).join(",")]);

  // Manage audio elements
  useEffect(() => {
    // Skip if no peers
    if (Object.keys(peersData).length === 0) return;

    // Create/update audio elements for peers
    Object.entries(peersData).forEach(([userId, { stream }]) => {
      if (!stream || !stream.getAudioTracks().length) return;
      createAudioElement(userId, stream);
    });

    // Cleanup function
    return () => {
      Object.keys(audioElementsRef.current).forEach((userId) => {
        if (!peersData[userId]) {
          removeAudioElement(userId);
        }
      });
    };
  }, [peersData]);

  // Request audio permission early
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        stream.getTracks().forEach((track) => track.stop());
      })
      .catch((err) => console.error("Audio permission denied:", err));
  }, []);

  // Initialize peer and media
  useEffect(() => {
    if (
      !currentUser ||
      !sessionId ||
      !connected ||
      videoInitialized ||
      peerInitializedRef.current
    ) {
      return;
    }

    peerInitializedRef.current = true;
    console.log("Starting peer initialization");

    // Create peer ID
    let peerId = `${currentUser.uid}-${sessionId}-${Math.random()
      .toString(36)
      .substring(2, 8)}`;
    const isProduction = window.location.hostname !== "localhost";

    // Get the appropriate API URL based on environment
    const apiUrl = isProduction
      ? import.meta.env.VITE_PRODUCTION_API_URL ||
        "https://codecolab-852p.onrender.com"
      : import.meta.env.VITE_API_URL || "http://localhost:3001";

    // Extract hostname from URL without protocol and path
    const getHostname = (url) => {
      if (!url)
        return isProduction ? "codecolab-852p.onrender.com" : "localhost";
      try {
        return new URL(url).hostname;
      } catch (e) {
        return isProduction ? "codecolab-852p.onrender.com" : "localhost";
      }
    };

    // Configure peer
    const peerConfig = {
      host: getHostname(apiUrl),
      port: isProduction ? 443 : 3001,
      path: "/peerjs",
      secure: isProduction,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      },
    };

    let retryTimeout = null;
    let connectionAttempts = 0;
    const maxAttempts = 3;

    const initializePeer = () => {
      // Clear previous timeout if any
      if (retryTimeout) clearTimeout(retryTimeout);

      // Destroy existing peer if any
      if (peerRef.current) {
        try {
          peerRef.current.destroy();
        } catch (e) {}
      }

      // Check max attempts
      if (connectionAttempts >= maxAttempts) return;
      connectionAttempts++;

      try {
        const peer = new Peer(peerId, peerConfig);
        setMyPeerContext(peer);

        // Connection opened
        peer.on("open", (id) => {
          console.log("PeerJS connection open:", id);
          connectionAttempts = 0;
          startMedia(peer);
        });

        // Handle errors
        peer.on("error", (error) => {
          console.error("PeerJS error:", error);
          setMyPeerContext(null);

          // Handle specific errors
          if (error.type === "unavailable-id") {
            peerId = `${currentUser.uid}-${sessionId}-${Math.random()
              .toString(36)
              .substring(2, 8)}`;
            retryTimeout = setTimeout(initializePeer, 1000);
          } else if (
            ["network", "server-error", "disconnected"].includes(error.type)
          ) {
            retryTimeout = setTimeout(initializePeer, 3000);
          }
        });

        // Handle disconnection
        peer.on("disconnected", () => {
          console.log("Peer disconnected, attempting reconnect");
          if (connectionAttempts < maxAttempts) {
            retryTimeout = setTimeout(() => {
              try {
                peer.reconnect();
              } catch (e) {
                initializePeer();
              }
            }, 2000);
          }
        });

        // Handle incoming calls
        peer.on("call", (call) => {
          const userId = call.peer.split("-")[0];
          if (peerConnectionsRef.current[userId]) return; // Skip duplicates

          if (myStreamRef.current) {
            call.answer(myStreamRef.current);
            setupCallHandlers(call, userId);
          } else {
            console.warn(
              "Received call but have no local stream to answer with"
            );
          }
        });
      } catch (err) {
        console.error("Error creating peer:", err);
        retryTimeout = setTimeout(initializePeer, 3000);
      }
    };

    // Start initialization
    initializePeer();

    // Cleanup on unmount
    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [currentUser, sessionId, connected, videoInitialized]);

  // Start media stream
  const startMedia = async (peerInstance) => {
    // Use existing stream if available
    if (myStreamRef.current) {
      setMyStream(myStreamRef.current);
      notifyServer(peerInstance);
      setVideoInitialized(true);
      return;
    }

    try {
      // Request media access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: true,
      });

      // Enable tracks by default
      stream.getTracks().forEach((track) => (track.enabled = true));

      // Update state
      setMyStream(stream);
      updateMyStreamContext(stream);
      setVideoInitialized(true);
      notifyServer(peerInstance);
    } catch (error) {
      console.error("Media access error:", error);
      setVideoEnabled(false);
      setAudioEnabled(false);

      // Notify server of disabled media
      if (socket && connected) {
        socket.emit("media-status-update", {
          sessionId,
          audioEnabled: false,
          videoEnabled: false,
        });
      }

      setVideoInitialized(true); // Mark as initialized despite failure
    }
  };

  // Notify server about joining video chat
  const notifyServer = (peerInstance) => {
    if (!socket || !connected || !peerInstance) return;

    socket.emit("video-join", {
      sessionId,
      userId: currentUser.uid,
      peerId: peerInstance.id,
    });

    socket.emit("media-status-update", {
      sessionId,
      audioEnabled,
      videoEnabled,
    });
  };

  // Create and manage audio elements
  const createAudioElement = (userId, stream) => {
    // Check for existing element
    if (audioElementsRef.current[userId]) {
      const existingEl = audioElementsRef.current[userId];

      // Update source if needed
      if (existingEl.srcObject !== stream) {
        existingEl.srcObject = stream;
        playAudio(existingEl, userId);
      }
      return;
    }

    // Create new element
    const audioEl = document.createElement("audio");
    audioEl.id = `audio-${userId}`;
    audioEl.autoplay = true;
    audioEl.playsInline = true; // iOS compatibility
    audioEl.setAttribute("playsinline", ""); // iOS compatibility
    audioEl.style.display = "none";
    audioEl.muted = false;
    audioEl.volume = 1.0;
    audioEl.srcObject = stream;

    // Add to DOM
    document.body.appendChild(audioEl);

    // Store reference
    audioElementsRef.current[userId] = audioEl;

    // Attempt to play
    playAudio(audioEl, userId);
  };

  // Play audio with auto-unlock for browsers
  const playAudio = (element, userId) => {
    element.play().catch((error) => {
      console.warn(`Audio autoplay failed for ${userId}:`, error);

      // Create unlock function
      const unlockAudio = () => {
        element
          .play()
          .catch((e) => console.warn("Still failed after interaction:", e));
      };

      // Add listeners for both click and touch
      document.addEventListener("click", unlockAudio, { once: true });
      document.addEventListener("touchstart", unlockAudio, { once: true });
    });
  };

  // Remove audio element
  const removeAudioElement = (userId) => {
    const audioEl = audioElementsRef.current[userId];
    if (!audioEl) return;

    try {
      audioEl.pause();
      audioEl.srcObject = null;
      if (audioEl.parentNode) {
        audioEl.parentNode.removeChild(audioEl);
      }
    } catch (e) {
      console.error(`Error removing audio for ${userId}:`, e);
    }

    delete audioElementsRef.current[userId];
  };

  // Set up call event handlers
  const setupCallHandlers = (call, userId) => {
    // Handle incoming stream
    call.on("stream", (remoteStream) => {
      setPeerStream(userId, remoteStream);
      setPeerConnection(userId, call);
      setPeersData((prev) => ({ ...prev, [userId]: { stream: remoteStream } }));

      // Schedule setup to ensure DOM is ready
      requestAnimationFrame(() => {
        setupRemoteVideo(userId, null, remoteStream);
        createAudioElement(userId, remoteStream);
      });
    });

    // Handle call close
    call.on("close", () => {
      removePeer(userId);
      removeAudioElement(userId);
      setPeersData((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    });

    // Handle errors
    call.on("error", (err) => console.error(`Call error with ${userId}:`, err));

    // Store connection
    setPeerConnection(userId, call);
  };

  // Set up remote video element
  const setupRemoteVideo = (userId, element, stream) => {
    // Handle different parameter patterns
    let videoEl = element;

    // If element not provided, find by ID
    if (!videoEl && stream) {
      videoEl = document.getElementById(`video-${userId}`);

      // If still not found, retry later
      if (!videoEl) {
        setTimeout(() => setupRemoteVideo(userId, null, stream), 100);
        return;
      }
    }

    // Skip if no element or stream
    if (!videoEl || !stream) return;

    // Set source if needed
    if (videoEl.srcObject !== stream) {
      videoEl.srcObject = stream;
      videoEl.playsInline = true;
      videoEl.setAttribute("playsinline", "");
      videoEl.muted = true; // Audio comes from separate audio elements

      // Play video
      videoEl
        .play()
        .catch((err) => console.warn(`Video play error for ${userId}:`, err));
    }
  };

  // Handle socket events for peers joining/leaving
  useEffect(() => {
    if (
      !socket ||
      !peerRef.current ||
      !myStreamRef.current ||
      !videoInitialized
    )
      return;

    const handleUserJoined = ({ userId, peerId }) => {
      // Skip if self or already connected
      if (
        peerId.startsWith(currentUser.uid) ||
        peerConnectionsRef.current[userId]
      )
        return;

      // Call the new peer
      try {
        const call = peerRef.current.call(peerId, myStreamRef.current);
        setupCallHandlers(call, userId);
      } catch (error) {
        console.error("Error calling peer:", error);
      }
    };

    const handleUserLeft = ({ userId }) => {
      removePeer(userId);
      removeAudioElement(userId);
      setPeersData((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    };

    // Add listeners
    socket.on("video-user-joined", handleUserJoined);
    socket.on("video-user-left", handleUserLeft);

    // Cleanup
    return () => {
      socket.off("video-user-joined", handleUserJoined);
      socket.off("video-user-left", handleUserLeft);
    };
  }, [
    socket,
    peerRef.current,
    myStreamRef.current,
    videoInitialized,
    currentUser?.uid,
  ]);

  // Toggle video
  const toggleVideo = () => {
    if (!myStreamRef.current) return;

    const videoTrack = myStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      const newState = !videoEnabled;
      videoTrack.enabled = newState;
      setVideoEnabled(newState);

      if (socket && connected) {
        socket.emit("media-status-update", {
          sessionId,
          audioEnabled,
          videoEnabled: newState,
        });
      }
    }
  };

  // Toggle audio
  const toggleAudio = () => {
    if (!myStreamRef.current) return;

    const audioTrack = myStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      const newState = !audioEnabled;
      audioTrack.enabled = newState;
      setAudioEnabled(newState);

      if (socket && connected) {
        socket.emit("media-status-update", {
          sessionId,
          audioEnabled: newState,
          videoEnabled,
        });
      }
    }
  };

  // Reset all connections
  const resetConnections = async () => {
    if (isResetting) return;
    setIsResetting(true);

    try {
      // Clear timeout if any
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }

      // Clean up audio elements
      Object.keys(audioElementsRef.current).forEach((userId) => {
        removeAudioElement(userId);
      });

      // Close peer connections
      Object.values(peerConnectionsRef.current).forEach((call) => {
        try {
          if (call?.close) call.close();
        } catch (e) {}
      });

      // Clear state
      setPeersData({});

      // Wait for cleanup
      await new Promise((resolve) => {
        resetTimeoutRef.current = setTimeout(() => {
          resetTimeoutRef.current = null;
          resolve();
        }, 500);
      });

      // Reconnect peer if needed
      if (socket && connected && peerRef.current) {
        if (peerRef.current.disconnected) {
          peerRef.current.reconnect();

          // Wait for reconnection
          await new Promise((resolve) => {
            resetTimeoutRef.current = setTimeout(() => {
              resetTimeoutRef.current = null;
              resolve();
            }, 1000);
          });
        }

        // Rejoin
        socket.emit("video-join", {
          sessionId,
          userId: currentUser.uid,
          peerId: peerRef.current.id,
        });

        // Update media status
        socket.emit("media-status-update", {
          sessionId,
          audioEnabled: true,
          videoEnabled: true,
        });

        // Update local state
        setAudioEnabled(true);
        setVideoEnabled(true);
      }
    } catch (error) {
      console.error("Reset failed:", error);
    } finally {
      setIsResetting(false);
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Clear timeout if any
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }

      // Remove all audio elements
      Object.keys(audioElementsRef.current).forEach((userId) => {
        removeAudioElement(userId);
      });
    };
  }, []);

  // Get peer connection count
  const peerCount = Object.keys(peersData).length;

  return (
    <div className="video-chat-container">
      <div className="video-header">
        <h3>Video Chat ({effectiveParticipants.length})</h3>
        <button className="close-button" onClick={onClose}>
          <FaTimes />
        </button>
      </div>

      <div className="audio-control-buttons">
        <button
          className={`connection-reset-button ${
            isResetting ? "resetting" : ""
          }`}
          onClick={resetConnections}
          disabled={isResetting}
          title="Reset all connections"
        >
          {isResetting ? "Resetting..." : "Reset Connections"}
        </button>

        <div className="audio-status-indicator">
          <div className="audio-status-dot">{peerCount > 0 ? "🟢" : "🔴"}</div>
          <span>
            {peerCount > 0
              ? `Connected to ${peerCount} peer(s)`
              : "No connections"}
          </span>
        </div>
      </div>

      <div className="videos-grid">
        <div className="video-item local-video">
          <video
            ref={myVideoRef}
            muted={true}
            autoPlay
            playsInline
            className={!videoEnabled ? "video-disabled" : ""}
          />
          <div className="video-label">
            {currentUser?.displayName || "You"}
            {!audioEnabled && (
              <FaMicrophoneSlash className="media-icon muted" />
            )}
            {!videoEnabled && <FaVideoSlash className="media-icon disabled" />}
          </div>
          {!myStream && videoInitialized && (
            <div className="video-loading">Waiting for stream...</div>
          )}
          {!videoInitialized && (
            <div className="video-loading">Initializing...</div>
          )}
        </div>

        {Object.entries(peersData).map(([userId, { stream }]) => {
          const participant = effectiveParticipants.find(
            (p) => p.id === userId
          );
          const name = participant?.name || "Participant";
          const isAudioMuted = participant?.audioEnabled === false;
          const isVideoDisabled = participant?.videoEnabled === false;

          return (
            <div key={userId} className="video-item">
              <video
                id={`video-${userId}`}
                autoPlay
                playsInline
                muted={true}
                ref={(element) => setupRemoteVideo(userId, element, stream)}
                className={isVideoDisabled ? "video-disabled" : ""}
              />
              <div className="video-label">
                {name}
                {isAudioMuted && (
                  <FaMicrophoneSlash className="media-icon muted" />
                )}
                {isVideoDisabled && (
                  <FaVideoSlash className="media-icon disabled" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="video-controls">
        <button
          className={`control-button ${!audioEnabled ? "disabled" : ""}`}
          onClick={toggleAudio}
        >
          {audioEnabled ? <FaMicrophone /> : <FaMicrophoneSlash />}
        </button>
        <button
          className={`control-button ${!videoEnabled ? "disabled" : ""}`}
          onClick={toggleVideo}
        >
          {videoEnabled ? <FaVideo /> : <FaVideoSlash />}
        </button>
        <div className="debug-info">
          {myStream
            ? `Cam: ${myStream.getVideoTracks()[0]?.label?.substring(0, 10)}...`
            : "No Cam"}{" "}
          | Peers: {Object.keys(peerConnectionsRef.current).length}
        </div>
      </div>
    </div>
  );
};

export default VideoChat;
