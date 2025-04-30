import React from "react";
import {
  FaPlay,
  FaExpand,
  FaCompress,
  FaPuzzlePiece,
  FaLightbulb,
  FaVideo,
  FaVideoSlash,
} from "react-icons/fa";
import { BsFillBrushFill } from "react-icons/bs";

const EditorToolbar = ({
  language,
  handleLanguageChange,
  showEditorTools,
  setShowEditorTools,
  currentChallenge,
  setShowChallengeDetailsModal,
  sessionId,
  handleChallengeButtonClick,
  handleRunCode,
  isRunning,
  isFullscreen,
  toggleFullscreen,
  onToggleVideoChat,
  showVideoChat,
}) => {
  return (
    <div className="editor-toolbar">
      <div className="toolbar-left">
        <div className="language-selector">
          <select value={language} onChange={handleLanguageChange}>
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
            <option value="csharp">C#</option>
          </select>
        </div>
        <button
          className={`editor-tools-toggle ${showEditorTools ? "active" : ""}`}
          onClick={() => setShowEditorTools(!showEditorTools)}
          title="Toggle editor tools"
        >
          <BsFillBrushFill />
        </button>

        {/* Active challenge display in toolbar */}
        {currentChallenge && (
          <button
            className="active-challenge-pill"
            onClick={() => setShowChallengeDetailsModal(true)}
            title="View challenge details"
          >
            <FaLightbulb />
            <span className="challenge-pill-title">
              {currentChallenge.title}
            </span>
            <span
              className={`difficulty-badge ${currentChallenge.difficulty.toLowerCase()}`}
            >
              {currentChallenge.difficulty}
            </span>
          </button>
        )}
      </div>

      <div className="toolbar-right">
        {sessionId !== "new" && (
          <>
            <button
              className={`video-chat-button ${showVideoChat ? "active" : ""}`}
              onClick={onToggleVideoChat}
              title={showVideoChat ? "Hide Video Chat" : "Show Video Chat"}
            >
              {showVideoChat ? <FaVideoSlash /> : <FaVideo />}
              <span className="button-text">
                {showVideoChat ? "End Call" : "Video Call"}
              </span>
            </button>

            <button
              className="challenge-button"
              onClick={handleChallengeButtonClick}
              title="Choose a coding challenge"
            >
              <FaPuzzlePiece />{" "}
              {currentChallenge ? "Change Challenge" : "Challenges"}
            </button>
          </>
        )}
        <button
          className="run-button"
          onClick={handleRunCode}
          disabled={isRunning}
        >
          <FaPlay /> {isRunning ? "Running..." : "Run Code"}
        </button>
        <button
          className="fullscreen-button"
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? <FaCompress /> : <FaExpand />}
        </button>
      </div>
    </div>
  );
};

export default EditorToolbar;
