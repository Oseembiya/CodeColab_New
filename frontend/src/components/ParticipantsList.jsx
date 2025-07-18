import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useSocket } from "../contexts/SocketContext";
import {
  FaCrown,
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
  FaSync,
} from "react-icons/fa";
import "../styles/components/ParticipantsList.css";

const ParticipantsList = ({ participants = [], currentUserId }) => {
  const { currentUser } = useAuth();
  const { socket, connected, requestUsersList } = useSocket();
  const [refreshing, setRefreshing] = useState(false);

  // Get session ID from URL if in a session
  const getSessionId = () => {
    const path = window.location.pathname;
    const isSession =
      path.includes("/session/") || path.includes("/whiteboard/");
    if (!isSession) return null;

    const parts = path.split("/");
    if (parts.length >= 3) {
      return parts[2];
    }
    return null;
  };

  // Ensure at least current user is added when participants list is empty
  const effectiveParticipants = React.useMemo(() => {
    if (participants && participants.length > 0) {
      return participants;
    }

    // If participants list is empty, create a default with just the current user
    if (currentUser) {
      return [
        {
          id: currentUser.uid || currentUserId || "local-user",
          name: currentUser.displayName || "You",
          isActive: true,
          audioEnabled: true,
          videoEnabled: true,
        },
      ];
    }

    return [];
  }, [participants, currentUser, currentUserId]);

  // Periodically request updated participants list to ensure synchronization
  useEffect(() => {
    const sessionId = getSessionId();
    if (!sessionId || sessionId === "new") return;

    // Request users list initially
    if (socket && connected) {
      requestUsersList(sessionId);
    }

    // Set up periodic refresh every 10 seconds
    const interval = setInterval(() => {
      if (socket && connected) {
        requestUsersList(sessionId);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [socket, connected, requestUsersList]);

  // Handle manual refresh of participant list
  const handleRefreshParticipants = () => {
    const sessionId = getSessionId();
    if (!sessionId || sessionId === "new") return;

    if (socket && connected) {
      setRefreshing(true);
      requestUsersList(sessionId);
      setTimeout(() => setRefreshing(false), 1000);
    }
  };

  // If no participants even after adding defaults, show placeholder
  if (!effectiveParticipants || effectiveParticipants.length === 0) {
    return (
      <div className="participants-list">
        <div className="participants-header">
          <h3>Participants</h3>
          <button
            className={`refresh-button ${refreshing ? "refreshing" : ""}`}
            onClick={handleRefreshParticipants}
            title="Refresh participants list"
          >
            <FaSync />
          </button>
        </div>
        <div className="no-participants">
          <p>Connecting...</p>
        </div>
      </div>
    );
  }

  // Sort participants: host first, then alphabetically
  const sortedParticipants = [...effectiveParticipants].sort((a, b) => {
    // Host comes first
    if (a.isHost && !b.isHost) return -1;
    if (!a.isHost && b.isHost) return 1;

    // Current user comes next
    if (a.id === currentUserId && b.id !== currentUserId) return -1;
    if (a.id !== currentUserId && b.id === currentUserId) return 1;

    // Then sort alphabetically by name
    return a.name?.localeCompare(b.name || "");
  });

  return (
    <div className="participants-list">
      <div className="participants-header">
        <h3>Participants ({effectiveParticipants.length})</h3>
        <button
          className={`refresh-button ${refreshing ? "refreshing" : ""}`}
          onClick={handleRefreshParticipants}
          title="Refresh participants list"
        >
          <FaSync />
        </button>
      </div>
      <ul>
        {sortedParticipants.map((participant) => (
          <li
            key={
              participant.id || participant.socketId || Math.random().toString()
            }
            className={`participant ${
              participant.id === currentUserId ? "current-user" : ""
            }`}
          >
            <div className="participant-avatar">
              {participant.avatar ? (
                <img src={participant.avatar} alt={participant.name} />
              ) : (
                <div className="avatar-placeholder">
                  {participant.name?.charAt(0).toUpperCase() || "?"}
                </div>
              )}
              <span
                className={`participant-status-indicator ${
                  participant.isActive ? "online" : "offline"
                }`}
              ></span>
            </div>

            <div className="participant-info">
              <div className="participant-name">
                {participant.name || "Anonymous"}
                {participant.isHost && (
                  <FaCrown className="host-icon" title="Host" />
                )}
                {participant.id === currentUserId && (
                  <span className="you-label">(You)</span>
                )}
              </div>

              {participant.status && (
                <div className="participant-status-indicator">
                  {participant.status}
                </div>
              )}
            </div>

            <div className="participant-media">
              {participant.audioEnabled === false && (
                <FaMicrophoneSlash
                  className="media-icon muted"
                  title="Audio muted"
                />
              )}
              {participant.videoEnabled === false && (
                <FaVideoSlash
                  className="media-icon disabled"
                  title="Video disabled"
                />
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ParticipantsList;
