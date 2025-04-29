import React, { useState, useEffect, useRef, useCallback } from "react";
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
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Refs
  const myVideoRef = useRef(null);
  const peerInitializedRef = useRef(false);
  const audioElementsRef = useRef({});
  const resetTimeoutRef = useRef(null);
  const pendingCallsRef = useRef([]);
  const isReconnectingRef = useRef(false);
  const lastPeerIdRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const alreadyJoinedRef = useRef(false);
  const initializationTimeoutRef = useRef(null);
  const lastInitAttemptRef = useRef(0);
  const effectCleanupRef = useRef(false);
  const reconnectTimeoutRef = useRef(null);

  // Create participant list from participants prop and peer connections
  const effectiveParticipants = React.useMemo(() => {
    // Use provided participants if available
    if (participants && participants.length > 0) {
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
  }, [myStreamRef.current, myStream, updateMyStreamContext]);

  // Sync peer data for rendering
  useEffect(() => {
    const newPeersData = {};
    Object.keys(peerStreamsRef.current).forEach((userId) => {
      newPeersData[userId] = { stream: peerStreamsRef.current[userId] };
    });

    const currentPeersStr = JSON.stringify(Object.keys(peersData).sort());
    const newPeersStr = JSON.stringify(Object.keys(newPeersData).sort());
    if (currentPeersStr !== newPeersStr) {
      console.log(
        "Updating peers data from",
        Object.keys(peersData),
        "to",
        Object.keys(newPeersData)
      );
      setPeersData(newPeersData);
    }
  }, [Object.keys(peerStreamsRef.current).join(","), peersData]);

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
      peerInitializedRef.current ||
      isReconnectingRef.current
    ) {
      return;
    }

    peerInitializedRef.current = true;
    console.log("Starting peer initialization");

    // Create peer ID
    let peerId = `${currentUser.uid}-${sessionId}-${Math.random()
      .toString(36)
      .substring(2, 8)}`;

    // Save the peer ID for comparison
    lastPeerIdRef.current = peerId;

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
      debug: 1, // Reduce debug level to limit console messages
    };

    let retryTimeout = null;
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
      if (reconnectAttemptsRef.current >= maxAttempts) {
        console.warn(
          `Exceeded max reconnection attempts (${maxAttempts}), stopping reconnection`
        );
        peerInitializedRef.current = false;
        isReconnectingRef.current = false;
        reconnectAttemptsRef.current = 0;
        return;
      }

      // If reconnecting, increment attempts
      if (isReconnectingRef.current) {
        reconnectAttemptsRef.current++;
      }

      try {
        console.log(`Creating PeerJS instance with ID: ${peerId}`);
        const peer = new Peer(peerId, peerConfig);
        setMyPeerContext(peer);

        // Connection opened
        peer.on("open", (id) => {
          console.log("PeerJS connection open:", id);
          reconnectAttemptsRef.current = 0;
          isReconnectingRef.current = false;
          startMedia(peer);

          // Process any pending calls
          processDelayedCalls();
        });

        // Handle errors
        peer.on("error", (error) => {
          console.error("PeerJS error:", error);

          // Handle specific errors
          if (error.type === "unavailable-id") {
            peerId = `${currentUser.uid}-${sessionId}-${Math.random()
              .toString(36)
              .substring(2, 8)}`;
            console.log(`ID collision, trying new ID: ${peerId}`);
            lastPeerIdRef.current = peerId;
            retryTimeout = setTimeout(initializePeer, 1000);
          } else if (
            ["network", "server-error", "disconnected"].includes(error.type)
          ) {
            // Only retry if not already reconnecting
            if (!isReconnectingRef.current) {
              isReconnectingRef.current = true;
              retryTimeout = setTimeout(initializePeer, 3000);
            }
          }
        });

        // Handle disconnection
        peer.on("disconnected", () => {
          console.log("Peer disconnected, attempting reconnect");

          // Prevent multiple reconnection attempts
          if (
            !isReconnectingRef.current &&
            reconnectAttemptsRef.current < maxAttempts
          ) {
            isReconnectingRef.current = true;
            retryTimeout = setTimeout(() => {
              try {
                // Try to reconnect the existing peer first
                if (peer && !peer.destroyed) {
                  peer.reconnect();
                } else {
                  // If peer is destroyed, create a new one
                  initializePeer();
                }
              } catch (e) {
                console.error("Error during reconnection:", e);
                initializePeer();
              }
            }, 3000);
          } else {
            console.log(
              "Already reconnecting or max attempts reached, skipping"
            );
          }
        });

        // Handle incoming calls
        peer.on("call", (call) => {
          console.log("Incoming call from:", call.peer);
          const userId = call.peer.split("-")[0];

          // Skip if we already have a connection for this user
          if (peerConnectionsRef.current[userId]) {
            console.log(`Already have connection for ${userId}, ignoring call`);
            return;
          }

          // Store the call temporarily if we don't have a stream yet
          if (!myStreamRef.current) {
            console.log(
              "Received call but no local stream yet, delaying answer"
            );
            pendingCallsRef.current.push({ call, userId });
            return;
          }

          // Answer the call with our stream
          console.log(`Answering call from ${userId} with local stream`);
          call.answer(myStreamRef.current);
          setupCallHandlers(call, userId);
        });
      } catch (err) {
        console.error("Error creating peer:", err);

        if (!isReconnectingRef.current) {
          isReconnectingRef.current = true;
          retryTimeout = setTimeout(initializePeer, 3000);
        }
      }
    };

    // Start initialization
    initializePeer();

    // Cleanup on unmount
    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
      peerInitializedRef.current = false;
      isReconnectingRef.current = false;
    };
  }, [currentUser, sessionId, connected, videoInitialized, setMyPeerContext]);

  // Function to process any delayed calls once we have a stream
  const processDelayedCalls = () => {
    if (pendingCallsRef.current.length > 0 && myStreamRef.current) {
      console.log(`Processing ${pendingCallsRef.current.length} delayed calls`);

      pendingCallsRef.current.forEach(({ call, userId }) => {
        try {
          console.log(`Now answering delayed call from ${userId}`);
          call.answer(myStreamRef.current);
          setupCallHandlers(call, userId);
        } catch (err) {
          console.error(`Error processing delayed call for ${userId}:`, err);
        }
      });

      // Clear the pending calls
      pendingCallsRef.current = [];
    }
  };

  // Start media stream
  const startMedia = async (peerInstance) => {
    // Use existing stream if available
    if (myStreamRef.current) {
      setMyStream(myStreamRef.current);
      notifyServer(peerInstance);
      setVideoInitialized(true);
      // Process any pending calls
      processDelayedCalls();
      return;
    }

    try {
      console.log("Requesting media access...");
      // Request media access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: true,
      });

      console.log(
        "Media access granted, got stream with tracks:",
        stream
          .getTracks()
          .map((t) => `${t.kind}:${t.label}`)
          .join(", ")
      );

      // Enable tracks by default
      stream.getTracks().forEach((track) => (track.enabled = true));

      // Update state
      setMyStream(stream);
      updateMyStreamContext(stream);
      setVideoInitialized(true);
      notifyServer(peerInstance);

      // Process any pending calls now that we have a stream
      processDelayedCalls();
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

    // Avoid sending duplicate join notifications
    if (alreadyJoinedRef.current && lastPeerIdRef.current === peerInstance.id) {
      console.log("Already joined with this peer ID, skipping notification");
      return;
    }

    console.log(`Notifying server about video join: ${peerInstance.id}`);

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

    // Mark as joined
    alreadyJoinedRef.current = true;
    lastPeerIdRef.current = peerInstance.id;
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
    console.log(`Setting up call handlers for user ${userId}`);

    // Handle incoming stream
    call.on("stream", (remoteStream) => {
      console.log(
        `Received stream from ${userId}`,
        `with ${remoteStream.getVideoTracks().length} video tracks and ${
          remoteStream.getAudioTracks().length
        } audio tracks`
      );

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
      console.log(`Call closed with ${userId}`);
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
      console.log(`Setting up video element for ${userId}`);
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
      console.log(`User joined video: ${userId} with peerId ${peerId}`);

      // Skip if self or already connected
      if (
        peerId.startsWith(currentUser.uid) ||
        peerConnectionsRef.current[userId]
      ) {
        console.log(`Skipping call to ${userId}: is self or already connected`);
        return;
      }

      // Call the new peer
      try {
        // Add a small delay to avoid race conditions
        setTimeout(() => {
          if (
            peerRef.current &&
            myStreamRef.current &&
            !peerConnectionsRef.current[userId]
          ) {
            console.log(`Initiating call to ${userId} (${peerId}) with stream`);
            const call = peerRef.current.call(peerId, myStreamRef.current);
            setupCallHandlers(call, userId);
          }
        }, 1000);
      } catch (error) {
        console.error(`Error calling peer ${userId}:`, error);
      }
    };

    const handleUserLeft = ({ userId }) => {
      console.log(`User left video: ${userId}`);
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

    // Request current users when joining - but only once
    if (!alreadyJoinedRef.current) {
      socket.emit("get-users", { sessionId });
    }

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
    sessionId,
    removePeer,
    setPeersData,
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
      alreadyJoinedRef.current = false;
      isReconnectingRef.current = false;
      reconnectAttemptsRef.current = 0;

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

      // Destroy and recreate peer
      if (peerRef.current) {
        try {
          peerRef.current.destroy();
        } catch (e) {}
        peerRef.current = null;
      }

      // Restart initialization process
      peerInitializedRef.current = false;

      // Wait for a moment
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Request users again
      if (socket && connected) {
        socket.emit("get-users", { sessionId });
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
      console.log("VideoChat component unmounting, cleaning up");

      // Clear timeout if any
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }

      // Remove all audio elements
      Object.keys(audioElementsRef.current).forEach((userId) => {
        removeAudioElement(userId);
      });

      // Notify server we're leaving
      if (socket && connected && sessionId) {
        socket.emit("video-user-left", {
          sessionId,
          userId: currentUser?.uid,
        });
      }

      // Reset all flags
      alreadyJoinedRef.current = false;
      isReconnectingRef.current = false;
      peerInitializedRef.current = false;
      reconnectAttemptsRef.current = 0;
    };
  }, [connected, currentUser, sessionId, socket]);

  // Get peer connection count
  const peerCount = Object.keys(peersData).length;

  // Initialize media stream (microphone)
  const initializeMedia = useCallback(async () => {
    if (!currentUser || !sessionId) return null;

    setInitializing(true);

    try {
      console.log("Initializing media stream");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      console.log("Media stream initialized successfully");
      setMyStream(stream);
      setError(null);
      setInitializing(false);
      return stream;
    } catch (err) {
      console.error("Error initializing media:", err);
      setError(`Could not access microphone: ${err.message}`);
      setInitializing(false);

      // Retry logic (max 3 attempts)
      if (retryCount < 3) {
        console.log(`Retrying media initialization (${retryCount + 1}/3)`);
        setRetryCount((r) => r + 1);

        // Clear any pending timeout
        if (initializationTimeoutRef.current) {
          clearTimeout(initializationTimeoutRef.current);
        }

        // Retry after delay
        initializationTimeoutRef.current = setTimeout(() => {
          initializeMedia();
        }, 2000);
      }

      return null;
    }
  }, [currentUser, sessionId, retryCount, setMyStream]);

  // Initialize peer connection
  const initializePeer = useCallback(
    async (stream) => {
      if (!currentUser || !sessionId || !stream || effectCleanupRef.current)
        return null;

      // Destroy existing peer connection if it exists and isn't already destroyed
      if (peerRef.current && !peerRef.current.destroyed) {
        console.log(
          "Destroying previous peer connection before creating new one."
        );
        peerRef.current.destroy();
      }
      // Clear any pending reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      setInitializing(true);
      setReconnecting(false);

      try {
        console.log(`Creating PeerJS instance with ID: ${currentUser.uid}`);
        const newPeer = new Peer(currentUser.uid, {
          host: getHostname(
            import.meta.env.VITE_API_URL || "http://localhost:3001"
          ),
          port: 3001,
          path: "/peerjs",
          secure: false,
          config: {
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: "stun:stun1.l.google.com:19302" },
            ],
          },
          debug: 1,
        });

        newPeer.on("open", (id) => {
          console.log(`PeerJS connection open: ${id}`);
          if (effectCleanupRef.current) return newPeer.destroy();

          setMyPeerContext(newPeer);
          setVideoInitialized(true);
          setInitializing(false);
          setReconnecting(false);

          if (socket && connected) {
            console.log(`Notifying server about peer ready: ${id}`);
            socket.emit("peer-ready", {
              roomId: sessionId,
              userId: currentUser.uid,
              peerId: id,
            });
          }
        });

        newPeer.on("call", (call) => {
          if (effectCleanupRef.current) return;
          console.log(`Receiving call from ${call.peer}`);

          call.answer(stream);
          setPeerConnection(call.peer, call);

          call.on("stream", (remoteStream) => {
            if (effectCleanupRef.current) return;
            console.log(`Received stream from ${call.peer}`);
            handleRemoteStream(call.peer, remoteStream);
          });

          call.on("close", () => {
            if (effectCleanupRef.current) return;
            console.log(`Call with ${call.peer} closed`);
            removePeer(call.peer);
            removeAudioElement(call.peer);
          });

          call.on("error", (err) => {
            if (effectCleanupRef.current) return;
            console.error(`Call error with ${call.peer}:`, err);
            removePeer(call.peer);
            removeAudioElement(call.peer);
          });
        });

        newPeer.on("error", (err) => {
          if (effectCleanupRef.current) return;
          console.error("PeerJS error:", err);
          setError(`Peer connection error: ${err.type}`);
          setInitializing(false);
          setReconnecting(false);

          if (
            err.type === "peer-unavailable" ||
            err.type === "network" ||
            err.type === "server-error"
          ) {
            console.log("Attempting full re-initialization after peer error.");
            if (!newPeer.destroyed) newPeer.destroy();
            setVideoInitialized(false);
          }
        });

        newPeer.on("disconnected", () => {
          if (effectCleanupRef.current || newPeer.destroyed) return;
          console.log("Peer disconnected from server. Attempting reconnect...");
          setError("Connection lost. Attempting to reconnect...");
          setReconnecting(true);
          setInitializing(false);

          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }

          reconnectTimeoutRef.current = setTimeout(() => {
            if (
              !effectCleanupRef.current &&
              !newPeer.destroyed &&
              newPeer.disconnected
            ) {
              try {
                console.log("Executing peer.reconnect()");
                newPeer.reconnect();
              } catch (reconnectErr) {
                console.error("Error calling peer.reconnect():", reconnectErr);
                setError(
                  "Reconnect failed. Please try closing and reopening the chat."
                );
                setReconnecting(false);
              }
            } else {
              console.log(
                "Skipping reconnect attempt (cleanup initiated, peer destroyed, or already reconnected)."
              );
              setReconnecting(false);
            }
          }, 3000);
        });

        newPeer.on("close", () => {
          if (effectCleanupRef.current) return;
          console.log("Peer connection closed permanently.");
          setError("Connection closed.");
          setVideoInitialized(false);
          setInitializing(false);
          setReconnecting(false);
        });

        return newPeer;
      } catch (err) {
        console.error("Fatal error during PeerJS initialization:", err);
        setError(`Peer setup failed: ${err.message}`);
        setInitializing(false);
        setReconnecting(false);
        return null;
      }
    },
    [
      currentUser,
      sessionId,
      socket,
      connected,
      setMyPeerContext,
      setPeerConnection,
      removePeer,
      setVideoInitialized,
      setIsInitializing,
      handleRemoteStream,
      removeAudioElement,
      peerRef,
    ]
  );

  // Connect to a specific peer
  const connectToPeer = useCallback(
    (peerId, userId) => {
      if (
        !peerRef.current ||
        peerRef.current.destroyed ||
        !myStreamRef.current
      ) {
        console.log(
          `Cannot connect to peer ${peerId} (${userId}): local peer or stream not ready.`
        );
        return;
      }
      if (peerId === peerRef.current.id) {
        console.log("Skipping call to self.");
        return;
      }
      if (
        peerConnectionsRef.current[userId] ||
        peerConnectionsRef.current[peerId]
      ) {
        console.log(
          `Already have a connection with ${userId} / ${peerId}. Skipping call.`
        );
        return;
      }

      try {
        console.log(`Calling peer ${peerId} (${userId})`);
        const call = peerRef.current.call(peerId, myStreamRef.current);
        if (!call) {
          console.error(`Failed to create call to ${peerId}`);
          return;
        }

        setPeerConnection(userId, call);

        call.on("stream", (remoteStream) => {
          if (effectCleanupRef.current) return;
          console.log(
            `Received stream from ${userId} (${peerId}) in outgoing call`
          );
          handleRemoteStream(userId, remoteStream);
        });

        call.on("close", () => {
          if (effectCleanupRef.current) return;
          console.log(`Outgoing call with ${userId} (${peerId}) closed`);
          removePeer(userId);
          removeAudioElement(userId);
        });

        call.on("error", (error) => {
          if (effectCleanupRef.current) return;
          console.error(
            `Outgoing call error with ${userId} (${peerId}):`,
            error
          );
          removePeer(userId);
          removeAudioElement(userId);
        });
      } catch (error) {
        console.error(`Failed to call peer ${peerId}:`, error);
      }
    },
    [
      peerRef,
      myStreamRef,
      setPeerConnection,
      handleRemoteStream,
      removePeer,
      removeAudioElement,
      peerConnectionsRef,
    ]
  );

  // Setup socket listeners for peer events
  const setupSocketListeners = useCallback(() => {
    if (!socket || !connected || !sessionId) return null;

    console.log("Setting up socket listeners for peer events");

    const handlePeerReady = ({ roomId, userId, peerId }) => {
      if (roomId !== sessionId || userId === currentUser?.uid) return;

      console.log(`Peer ${userId} (${peerId}) is ready in room ${roomId}`);
      connectToPeer(peerId, userId);
    };

    const handleUserDisconnect = ({ roomId, userId }) => {
      if (roomId !== sessionId || userId === currentUser?.uid) return;

      console.log(
        `Server notified: User ${userId} disconnected from room ${roomId}`
      );
      removePeer(userId);
      removeAudioElement(userId);
    };

    socket.on("peer-ready", handlePeerReady);
    socket.on("user-disconnect", handleUserDisconnect);

    return () => {
      console.log("Removing socket listeners for peer events");
      socket.off("peer-ready", handlePeerReady);
      socket.off("user-disconnect", handleUserDisconnect);
    };
  }, [
    socket,
    connected,
    sessionId,
    currentUser,
    connectToPeer,
    removePeer,
    removeAudioElement,
  ]);

  // Main effect for video chat initialization
  useEffect(() => {
    if (
      !sessionId ||
      !currentUser ||
      !socket ||
      !connected ||
      videoInitialized ||
      initializing ||
      reconnecting
    ) {
      console.log("Skipping main initialization effect:", {
        sessionId,
        currentUser: !!currentUser,
        socket: !!socket,
        connected,
        videoInitialized,
        initializing,
        reconnecting,
      });
      return;
    }

    const now = Date.now();
    if (now - lastInitAttemptRef.current < 5000) {
      console.log("Throttling main initialization attempts");
      return;
    }
    lastInitAttemptRef.current = now;

    console.log("Starting main video chat setup");
    effectCleanupRef.current = false;

    if (initializationTimeoutRef.current) {
      clearTimeout(initializationTimeoutRef.current);
    }

    let mounted = true;

    const initialize = async () => {
      if (!mounted || effectCleanupRef.current) return;

      setInitializing(true);
      setError(null);

      try {
        const stream = await initializeMedia();
        if (!stream || !mounted || effectCleanupRef.current) {
          console.log(
            "Main effect: Media initialization failed or component unmounted."
          );
          if (mounted) setInitializing(false);
          return;
        }

        await initializePeer(stream);
      } catch (err) {
        console.error(
          "Error during main video chat initialization sequence:",
          err
        );
        if (mounted) {
          setError("Failed to initialize video chat");
          setInitializing(false);
        }
      }
    };

    initialize();

    return () => {
      mounted = false;
      console.log("Cleaning up main video chat effect");
      effectCleanupRef.current = true;

      if (initializationTimeoutRef.current) {
        clearTimeout(initializationTimeoutRef.current);
        initializationTimeoutRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      console.log("Main effect cleanup: Not destroying peer instance here.");
    };
  }, [
    sessionId,
    currentUser,
    socket,
    connected,
    videoInitialized,
    initializing,
    reconnecting,
  ]);

  // Setup socket listeners (runs once peer is initialized)
  useEffect(() => {
    if (
      !sessionId ||
      !socket ||
      !connected ||
      !videoInitialized ||
      reconnecting
    )
      return;

    console.log("Setting up socket listeners effect.");
    const cleanupListeners = setupSocketListeners();

    return () => {
      console.log("Cleaning up socket listeners effect.");
      if (typeof cleanupListeners === "function") {
        cleanupListeners();
      }
    };
  }, [
    sessionId,
    socket,
    connected,
    videoInitialized,
    reconnecting,
    setupSocketListeners,
  ]);

  // Cleanup effect for component unmount (distinct from main init effect cleanup)
  useEffect(() => {
    return () => {
      console.log("VideoChat component is unmounting - final cleanup.");
      effectCleanupRef.current = true;

      Object.keys(audioElementsRef.current).forEach((userId) => {
        removeAudioElement(userId);
      });
      audioElementsRef.current = {};

      if (initializationTimeoutRef.current) {
        clearTimeout(initializationTimeoutRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      console.log(
        "Component unmount: Relying on VideoContext for peer/stream cleanup."
      );
    };
  }, [removeAudioElement]);

  // Toggle microphone
  const toggleMicrophone = useCallback(() => {
    if (!myStreamRef.current) return;

    const audioTracks = myStreamRef.current.getAudioTracks();
    if (audioTracks.length === 0) return;

    const newState = !audioTracks[0].enabled;
    setAudioEnabled(newState);

    audioTracks.forEach((track) => {
      track.enabled = newState;
    });

    setMuted(!newState);
  }, [myStreamRef, setMuted]);

  // Handle close button click
  const handleClose = useCallback(() => {
    console.log("Close button clicked.");
    if (onClose) onClose();
  }, [onClose]);

  // Render logic
  if (!sessionId) {
    return null;
  }

  const displayParticipants = effectiveParticipants.filter(
    (p) => p.id !== currentUser?.uid
  );

  return (
    <div className="video-chat-container">
      <div className="video-header">
        <h3>Video Chat ({effectiveParticipants.length})</h3>
        <button className="close-button" onClick={handleClose}>
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
      </div>
    </div>
  );
};

export default VideoChat;
