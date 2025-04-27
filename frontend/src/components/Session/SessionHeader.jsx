import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { FaSave, FaCog, FaPencilAlt } from "react-icons/fa";

const SessionHeader = ({
  isFullscreen,
  sessionId,
  currentSession,
  connected,
  handleExitCollaboration,
  handleSave,
  setShowSettings,
  showSettings,
}) => {
  // Debug logging to help diagnose the issue
  useEffect(() => {
    console.log("SessionHeader received currentSession:", currentSession);
    console.log("SessionHeader received sessionId:", sessionId);
  }, [currentSession, sessionId]);

  // Get the title to display
  const getDisplayTitle = () => {
    if (sessionId === "new") {
      return "Standalone Editor";
    }

    // If we want titles starting with @ to display without "Session:" prefix
    // Check if currentSession exists and has a title/name property
    let sessionTitle = "Session: " + sessionId.substring(0, 8);

    if (currentSession) {
      // Check both name and title properties since APIs might use different properties
      const displayName = currentSession.name || currentSession.title;

      if (displayName) {
        if (displayName.startsWith("@")) {
          sessionTitle = displayName;
        } else {
          sessionTitle = `Session: ${displayName}`;
        }
      }
    }

    return sessionTitle;
  };

  return (
    <div className={`session-header ${isFullscreen ? "hidden" : ""}`}>
      <div className="header-left">
        <h1>{getDisplayTitle()}</h1>
        <div className="connection-status">
          <span
            className={`status-indicator ${
              sessionId === "new"
                ? "standalone"
                : connected
                ? "connected"
                : "disconnected"
            }`}
          ></span>
          {sessionId === "new"
            ? "Standalone Mode"
            : connected
            ? "Connected"
            : "Disconnected"}
        </div>
      </div>

      <div className="header-right">
        {sessionId !== "new" && (
          <button
            className="exit-collab-button"
            onClick={handleExitCollaboration}
            title="Exit collaboration and work in standalone mode"
          >
            Exit Collaboration
          </button>
        )}
        <Link to={`/whiteboard/${sessionId}`} className="whiteboard-link">
          <FaPencilAlt /> Whiteboard
        </Link>
        <button className="save-button" onClick={handleSave}>
          <FaSave /> Save
        </button>
        <button
          className="icon-button"
          onClick={() => setShowSettings(!showSettings)}
        >
          <FaCog />
        </button>
      </div>
    </div>
  );
};

export default SessionHeader;
