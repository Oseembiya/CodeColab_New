import React from "react";
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
  return (
    <div className={`session-header ${isFullscreen ? "hidden" : ""}`}>
      <div className="header-left">
        <h1>
          {sessionId === "new"
            ? "Standalone Editor"
            : `Session: ${currentSession?.title || sessionId.substring(0, 8)}`}
        </h1>
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
