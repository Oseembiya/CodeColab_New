import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useSession } from "../contexts/SessionContext";
import { useSocket } from "../contexts/SocketContext";
import { useVideo } from "../contexts/VideoContext";
import { useAuth } from "../contexts/AuthContext";
import { useUserMetrics } from "../contexts/UserMetricsContext";
import Editor from "@monaco-editor/react";
import {
  FaCode,
  FaPlay,
  FaSave,
  FaCog,
  FaUsers,
  FaExpand,
  FaCompress,
  FaCopy,
  FaPaste,
  FaUndo,
  FaRedo,
  FaSearch,
  FaFont,
  FaFileUpload,
  FaFileDownload,
  FaIndent,
  FaMinus,
  FaPlus,
  FaMoon,
  FaSun,
  FaEraser,
  FaPencilAlt,
  FaTerminal,
  FaTimes,
  FaChevronUp,
  FaChevronDown,
  FaClipboard,
  FaTrash,
} from "react-icons/fa";
import { BsFillBrushFill } from "react-icons/bs";
import VideoChat from "../components/VideoChat";
import ParticipantsList from "../components/ParticipantsList";
import "../styles/pages/Session.css";

// Main Session Component
const Session = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { currentSession, joinSession, leaveSession } = useSession();
  const { socket, connected, authenticate } = useSocket();
  const {
    isVideoOpen,
    setIsVideoOpen,
    openVideoChat,
    activeVideoSession,
    setActiveVideoSession,
  } = useVideo();
  const { incrementMetrics } = useUserMetrics();

  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const isUnmountingRef = useRef(false);
  const sessionInitializedRef = useRef(false);

  const [code, setCode] = useState("// Start coding here\n\n");
  const [language, setLanguage] = useState("javascript");
  const [theme, setTheme] = useState("vs-dark");
  const [output, setOutput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [showEditorTools, setShowEditorTools] = useState(false);
  const [outputHeight, setOutputHeight] = useState(200);
  const [isOutputMinimized, setIsOutputMinimized] = useState(false);
  const [isOutputMaximized, setIsOutputMaximized] = useState(false);
  const [participants, setParticipants] = useState([]);
  const outputDragRef = useRef(null);
  const startDragYRef = useRef(null);
  const startHeightRef = useRef(null);
  const [codeChangeTimeout, setCodeChangeTimeout] = useState(null);
  const [previousLineCount, setPreviousLineCount] = useState(0);

  // Set active video session when this component mounts
  useEffect(() => {
    if (sessionId && sessionId !== "new" && sessionId !== activeVideoSession) {
      setActiveVideoSession(sessionId);
    }
  }, [sessionId, activeVideoSession, setActiveVideoSession]);

  // Initialize session
  useEffect(() => {
    // Skip if unmounting
    if (isUnmountingRef.current) return;

    const initSession = async () => {
      if (!sessionId) return;

      // If we've already initialized this specific session, don't do it again
      if (sessionInitializedRef.current && currentSession?.id === sessionId) {
        return;
      }

      // Mark as initialized for this session
      sessionInitializedRef.current = true;

      if (sessionId === "new") {
        // Standalone mode - NO session joining or creation
        // Just initialize the local editor with default values
        setCode("// Start coding here\n\n");
        setLanguage("javascript");

        // Set participants to just the current user for UI purposes
        setParticipants([
          {
            id: currentUser?.uid || "local-user",
            name: currentUser?.displayName || "You",
            isActive: true,
            audioEnabled: true,
            videoEnabled: true,
          },
        ]);
      } else {
        // Collaborative mode
        try {
          const sessionData = await joinSession(sessionId);
          if (sessionData) {
            setCode(sessionData.code || "// Start coding here\n\n");
            setLanguage(sessionData.language || "javascript");
          }

          // Subscribe to code updates
          if (socket) {
            // Force at least the current user as participant
            if (currentUser && participants.length === 0) {
              setParticipants([
                {
                  id: currentUser.uid,
                  name: currentUser.displayName || "You",
                  isActive: true,
                  audioEnabled: true,
                  videoEnabled: true,
                },
              ]);
            }

            socket.emit("join-session", sessionId);

            socket.on("code-update", (data) => {
              if (data.sessionId === sessionId) {
                setCode(data.content);
              }
            });

            // Authenticate for advanced features
            if (currentUser) {
              authenticate({
                sessionId,
                user: {
                  uid: currentUser.uid,
                  displayName: currentUser.displayName || "Anonymous",
                  email: currentUser.email,
                  photoURL: currentUser.photoURL,
                },
              });
            }

            // Listen for participant updates
            socket.on("users-update", (users) => {
              if (Array.isArray(users) && users.length > 0) {
                // Make sure current user is included
                const currentUserExists = users.some(
                  (u) => u.id === currentUser?.uid
                );

                // Create a more reliable participants list with proper media status
                const updatedUsers = currentUserExists
                  ? [...users]
                  : [
                      ...users,
                      {
                        id: currentUser.uid,
                        name: currentUser.displayName || "You",
                        isActive: true,
                        audioEnabled: true,
                        videoEnabled: true,
                      },
                    ];

                // Store this comprehensive list directly
                setParticipants(updatedUsers);
              } else {
                // Only add current user as fallback if we actually have one
                if (currentUser) {
                  const fallbackUser = {
                    id: currentUser.uid,
                    name: currentUser.displayName || "You",
                    isActive: true,
                    audioEnabled: true,
                    videoEnabled: true,
                  };
                  setParticipants([fallbackUser]);
                }
              }
            });

            // Explicitly request the current users list
            socket.emit("get-users", { sessionId });
          }
        } catch (error) {
          console.error("Failed to join session:", error);
          if (!isUnmountingRef.current) {
            navigate("/session/new"); // Redirect to standalone mode on error
          }
        }
      }
    };

    // Only reset initialized flag when sessionId actually changes
    if (sessionInitializedRef.current && sessionId !== currentSession?.id) {
      sessionInitializedRef.current = false;
    }

    isUnmountingRef.current = false;
    initSession();

    // Ensure participants list has at least the current user even if server doesn't send updates
    const participantsTimer = setTimeout(() => {
      if (
        participants.length === 0 &&
        currentUser &&
        !isUnmountingRef.current
      ) {
        setParticipants([
          {
            id: currentUser.uid,
            name: currentUser.displayName || "You",
            isActive: true,
            audioEnabled: true,
            videoEnabled: true,
          },
        ]);
      }
    }, 3000);

    // Cleanup when leaving the page
    return () => {
      isUnmountingRef.current = true;
      clearTimeout(participantsTimer);

      if (socket && connected && sessionId && sessionId !== "new") {
        // Notify server that user is leaving the session
        socket.emit("leave-session", {
          sessionId,
          userId: currentUser?.uid,
        });

        // Clean up listeners
        socket.off("code-update");
        socket.off("users-update");
      }

      // Only call leaveSession if in collaborative mode
      if (sessionId && sessionId !== "new" && currentSession) {
        leaveSession();
      }
    };
  }, [
    sessionId,
    joinSession,
    leaveSession,
    socket,
    navigate,
    currentUser,
    authenticate,
    currentSession,
  ]);

  // Exit collaboration mode and switch to standalone mode
  const handleExitCollaboration = () => {
    if (socket && connected) {
      // Notify server that user is intentionally leaving the session
      socket.emit("leave-session", {
        sessionId,
        userId: currentUser?.uid,
      });

      // Remove socket listeners
      socket.off("code-update");
      socket.off("users-update");
    }

    isUnmountingRef.current = true;
    leaveSession();
    navigate("/session/new");
  };

  // Handle editor mounting
  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;
  };

  // Handle code changes with metrics tracking
  const handleCodeChange = (value) => {
    setCode(value);

    // Count lines for metrics
    const currentLineCount = value.split("\n").length;

    // Only send updates in collaborative mode
    if (socket && connected && sessionId !== "new") {
      socket.emit("code-change", {
        sessionId,
        content: value,
      });
    }

    // Track metrics: debounce to prevent excessive updates
    if (codeChangeTimeout) {
      clearTimeout(codeChangeTimeout);
    }

    setCodeChangeTimeout(
      setTimeout(() => {
        // If lines increased, update metrics
        if (currentLineCount > previousLineCount) {
          incrementMetrics({
            linesOfCode: currentLineCount - previousLineCount,
          });
        }
        setPreviousLineCount(currentLineCount);
      }, 5000)
    ); // 5 second debounce
  };

  // Handle language change
  const handleLanguageChange = (e) => {
    const newLanguage = e.target.value;
    setLanguage(newLanguage);

    // Only notify others in collaborative mode
    if (socket && connected && sessionId !== "new") {
      socket.emit("language-change", {
        sessionId,
        language: newLanguage,
        senderId: "user-123",
      });
    }
  };

  // Run code simulation
  const handleRunCode = async () => {
    setIsRunning(true);
    setOutput("Running code...");

    try {
      // Use the appropriate API URL based on environment
      const apiBaseUrl =
        import.meta.env.MODE === "development"
          ? import.meta.env.VITE_API_URL || "http://localhost:3001"
          : import.meta.env.VITE_PRODUCTION_API_URL ||
            "https://codecolab-852p.onrender.com";

      // In production, we need the full URL, in development relative works with proxy
      const apiUrl = `${apiBaseUrl}/api/code/execute`;

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          language,
          stdin: "", // Could add input field in UI
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API error:", response.status, errorText);
        setOutput(`Server Error (${response.status}):\n${errorText}`);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      if (result.status && result.status.id !== 3) {
        // Not Accepted
        setOutput(
          `Error: ${result.status.description}\n${result.stderr || ""}`
        );
      } else {
        setOutput(result.stdout || "Code executed successfully (no output)");
      }
    } catch (error) {
      console.error("Error running code:", error);
      setOutput(`Failed to execute code: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Handle save
  const handleSave = () => {
    // Simulate saving
    alert("Code saved successfully!");
  };

  // Handle fullscreen toggle
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Handle escape key to exit fullscreen
  useEffect(() => {
    const handleEscPress = (event) => {
      if (event.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleEscPress);

    return () => {
      window.removeEventListener("keydown", handleEscPress);
    };
  }, [isFullscreen]);

  // Focus editor when entering fullscreen
  useEffect(() => {
    if (isFullscreen && editorRef.current) {
      setTimeout(() => {
        editorRef.current.focus();
      }, 100);
    }
  }, [isFullscreen]);

  // Editor tools functions
  const handleFormatCode = () => {
    if (editorRef.current) {
      editorRef.current.getAction("editor.action.formatDocument").run();
    }
  };

  const handleUndo = () => {
    if (editorRef.current) {
      editorRef.current.trigger("keyboard", "undo", null);
    }
  };

  const handleRedo = () => {
    if (editorRef.current) {
      editorRef.current.trigger("keyboard", "redo", null);
    }
  };

  const handleCopy = () => {
    if (editorRef.current) {
      const selection = editorRef.current.getSelection();
      const selectedText = editorRef.current
        .getModel()
        .getValueInRange(selection);
      navigator.clipboard.writeText(selectedText);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (editorRef.current) {
        editorRef.current.trigger("keyboard", "paste", null);
      }
    } catch (err) {
      console.error("Failed to paste:", err);
    }
  };

  const handleFind = () => {
    if (editorRef.current) {
      editorRef.current.trigger("keyboard", "actions.find", null);
    }
  };

  const handleFontSizeChange = (delta) => {
    const newSize = Math.max(8, Math.min(30, fontSize + delta));
    setFontSize(newSize);
  };

  const handleToggleTheme = () => {
    setTheme(theme === "vs-dark" ? "vs" : "vs-dark");
  };

  const handleUploadCode = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setCode(e.target.result);
      };
      reader.readAsText(file);
    }
  };

  const handleDownloadCode = () => {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `codecolab-${sessionId.substring(0, 8)}.${getFileExtension(
      language
    )}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getFileExtension = (lang) => {
    const extensions = {
      javascript: "js",
      typescript: "ts",
      python: "py",
      java: "java",
      csharp: "cs",
    };
    return extensions[lang] || "txt";
  };

  const handleClearEditor = () => {
    if (window.confirm("Are you sure you want to clear the editor?")) {
      setCode("// Start coding here\n\n");
    }
  };

  // Handle output panel resize
  const handleOutputDragStart = (e) => {
    e.preventDefault();
    startDragYRef.current = e.clientY;
    startHeightRef.current = outputHeight;
    document.addEventListener("mousemove", handleOutputDrag);
    document.addEventListener("mouseup", handleOutputDragEnd);
    document.body.style.cursor = "ns-resize";
    document.body.classList.add("resizing");
  };

  const handleOutputDrag = (e) => {
    if (startDragYRef.current === null) return;

    requestAnimationFrame(() => {
      const deltaY = startDragYRef.current - e.clientY;
      const newHeight = Math.max(
        50,
        Math.min(600, startHeightRef.current + deltaY)
      );
      setOutputHeight(newHeight);
    });
  };

  const handleOutputDragEnd = () => {
    startDragYRef.current = null;
    document.removeEventListener("mousemove", handleOutputDrag);
    document.removeEventListener("mouseup", handleOutputDragEnd);
    document.body.style.cursor = "";
    document.body.classList.remove("resizing");
  };

  const toggleOutputMinimize = () => {
    if (isOutputMaximized) {
      setIsOutputMaximized(false);
    } else {
      setIsOutputMinimized(!isOutputMinimized);
    }
  };

  const toggleOutputMaximize = () => {
    if (isOutputMinimized) {
      setIsOutputMinimized(false);
    } else {
      setIsOutputMaximized(!isOutputMaximized);
    }
  };

  const copyOutputToClipboard = () => {
    navigator.clipboard.writeText(output);
  };

  const clearOutput = () => {
    setOutput("");
  };

  // Determine editor height based on output state
  const getEditorContainerClass = () => {
    if (isOutputMinimized) return "editor-container output-minimized";
    if (isOutputMaximized) return "editor-container output-maximized";
    return "editor-container";
  };

  // Open or close video chat
  const toggleVideoChat = () => {
    if (sessionId === "new") return; // Don't allow video in standalone mode

    if (isVideoOpen) {
      setIsVideoOpen(false);
    } else {
      openVideoChat(sessionId);
    }
  };

  // Track session time
  useEffect(() => {
    let sessionTimer;
    let sessionStartTime;

    // Only track time when in a session
    if (sessionId && currentUser) {
      sessionStartTime = new Date();

      // Update session time every 5 minutes
      sessionTimer = setInterval(() => {
        const currentTime = new Date();
        const timeSpentHours =
          (currentTime - sessionStartTime) / (1000 * 60 * 60);

        if (timeSpentHours >= 0.05) {
          // 3 minutes minimum (0.05 hours)
          incrementMetrics({ hoursSpent: timeSpentHours });
          sessionStartTime = currentTime; // Reset for next interval
        }
      }, 5 * 60 * 1000); // Check every 5 minutes
    }

    return () => {
      if (codeChangeTimeout) {
        clearTimeout(codeChangeTimeout);
      }

      if (sessionTimer) {
        clearInterval(sessionTimer);

        // Final time update when leaving
        if (sessionStartTime && currentUser) {
          const endTime = new Date();
          const finalTimeSpentHours =
            (endTime - sessionStartTime) / (1000 * 60 * 60);

          if (finalTimeSpentHours >= 0.01) {
            // Track if at least 36 seconds (0.01 hours)
            incrementMetrics({ hoursSpent: finalTimeSpentHours });
          }
        }
      }
    };
  }, [sessionId, currentUser, incrementMetrics]);

  return (
    <div className="session-container">
      {/* Session Header */}
      <div className={`session-header ${isFullscreen ? "hidden" : ""}`}>
        <div className="header-left">
          <h1>
            {sessionId === "new"
              ? "Standalone Editor"
              : `Session: ${
                  currentSession?.title || sessionId.substring(0, 8)
                }`}
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

      {/* Main content area */}
      <div
        className={`session-content ${
          isFullscreen ? "fullscreen-content" : ""
        } ${sessionId === "new" ? "standalone-mode" : ""}`}
      >
        {/* Sidebar with participants - only show in collaborative mode */}
        {sessionId !== "new" && (
          <div className={`session-sidebar ${isFullscreen ? "hidden" : ""}`}>
            <ParticipantsList
              participants={participants}
              currentUserId={currentUser?.uid}
            />
          </div>
        )}

        {/* Editor area - adjust width when in standalone mode */}
        <div
          className={`editor-area ${isFullscreen ? "fullscreen-editor" : ""} ${
            sessionId === "new" ? "standalone-mode" : ""
          }`}
        >
          {/* Editor toolbar - keep visible in fullscreen */}
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
                className={`editor-tools-toggle ${
                  showEditorTools ? "active" : ""
                }`}
                onClick={() => setShowEditorTools(!showEditorTools)}
                title="Toggle editor tools"
              >
                <BsFillBrushFill />
              </button>
            </div>

            <div className="toolbar-right">
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

          {/* Editor tools bar */}
          {showEditorTools && (
            <div className="editor-tools-bar">
              <div className="tools-group">
                <button
                  className="tool-button"
                  onClick={handleFormatCode}
                  title="Format code"
                >
                  <FaIndent />
                </button>
                <button
                  className="tool-button"
                  onClick={handleUndo}
                  title="Undo"
                >
                  <FaUndo />
                </button>
                <button
                  className="tool-button"
                  onClick={handleRedo}
                  title="Redo"
                >
                  <FaRedo />
                </button>
              </div>

              <div className="tools-group">
                <button
                  className="tool-button"
                  onClick={handleCopy}
                  title="Copy"
                >
                  <FaCopy />
                </button>
                <button
                  className="tool-button"
                  onClick={handlePaste}
                  title="Paste"
                >
                  <FaPaste />
                </button>
                <button
                  className="tool-button"
                  onClick={handleFind}
                  title="Find"
                >
                  <FaSearch />
                </button>
              </div>

              <div className="tools-group">
                <button
                  className="tool-button"
                  onClick={() => handleFontSizeChange(-1)}
                  title="Decrease font size"
                >
                  <FaMinus />
                </button>
                <span className="font-size-display">
                  <FaFont /> {fontSize}px
                </span>
                <button
                  className="tool-button"
                  onClick={() => handleFontSizeChange(1)}
                  title="Increase font size"
                >
                  <FaPlus />
                </button>
              </div>

              <div className="tools-group">
                <button
                  className="tool-button"
                  onClick={handleToggleTheme}
                  title={`Switch to ${
                    theme === "vs-dark" ? "light" : "dark"
                  } theme`}
                >
                  {theme === "vs-dark" ? <FaSun /> : <FaMoon />}
                </button>
                <button
                  className="tool-button"
                  onClick={handleUploadCode}
                  title="Upload code"
                >
                  <FaFileUpload />
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: "none" }}
                    accept=".js,.ts,.py,.java,.cs,.txt"
                    onChange={handleFileChange}
                  />
                </button>
                <button
                  className="tool-button"
                  onClick={handleDownloadCode}
                  title="Download code"
                >
                  <FaFileDownload />
                </button>
                <button
                  className="tool-button danger"
                  onClick={handleClearEditor}
                  title="Clear editor"
                >
                  <FaEraser />
                </button>
              </div>
            </div>
          )}

          {/* Editor and output container */}
          <div className="editor-output-container">
            {/* Code editor */}
            <div className={getEditorContainerClass()}>
              <Editor
                height="100%"
                width="100%"
                language={language}
                theme={theme}
                value={code}
                onChange={handleCodeChange}
                onMount={handleEditorDidMount}
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: fontSize,
                  wordWrap: "on",
                  automaticLayout: true,
                }}
              />
            </div>

            {/* Output panel */}
            {output && (
              <div
                className={`output-panel ${
                  isOutputMinimized ? "minimized" : ""
                } ${isOutputMaximized ? "maximized" : ""}`}
                style={
                  !isOutputMinimized && !isOutputMaximized
                    ? { height: outputHeight + "px" }
                    : {}
                }
              >
                <div
                  className="output-resize-handle"
                  onMouseDown={handleOutputDragStart}
                  ref={outputDragRef}
                />
                <div className="output-header">
                  <div className="output-header-left">
                    <FaTerminal /> <h3>Output</h3>
                  </div>
                  <div className="output-header-actions">
                    <button
                      className="output-action-button"
                      onClick={copyOutputToClipboard}
                      title="Copy to clipboard"
                    >
                      <FaClipboard />
                    </button>
                    <button
                      className="output-action-button"
                      onClick={clearOutput}
                      title="Clear output"
                    >
                      <FaTrash />
                    </button>
                    <button
                      className="output-action-button"
                      onClick={toggleOutputMinimize}
                      title={isOutputMinimized ? "Expand" : "Minimize"}
                    >
                      {isOutputMinimized ? <FaChevronUp /> : <FaChevronDown />}
                    </button>
                    <button
                      className="output-action-button"
                      onClick={toggleOutputMaximize}
                      title={isOutputMaximized ? "Restore" : "Maximize"}
                    >
                      {isOutputMaximized ? <FaCompress /> : <FaExpand />}
                    </button>
                    <button
                      className="output-close-button"
                      onClick={() => setOutput("")}
                    >
                      <FaTimes />
                    </button>
                  </div>
                </div>
                <pre className="output-content">{output}</pre>
              </div>
            )}
          </div>
        </div>

        {/* Video panel - only show in collaborative mode */}
        {sessionId !== "new" && isVideoOpen && (
          <div className="video-panel">
            <VideoChat
              sessionId={sessionId}
              onClose={() => setIsVideoOpen(false)}
              participants={participants}
            />
          </div>
        )}

        {/* Show video button - only in collaborative mode */}
        {sessionId !== "new" && !isVideoOpen && (
          <button className="video-show-button" onClick={toggleVideoChat}>
            <FaUsers /> Show Video
          </button>
        )}
      </div>

      {/* Settings panel (appears when settings button is clicked) */}
      {showSettings && (
        <div
          className="settings-overlay"
          onClick={() => setShowSettings(false)}
        >
          <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
            <h2>Settings</h2>

            <div className="setting-group">
              <label htmlFor="theme-select">Editor Theme</label>
              <select
                id="theme-select"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
              >
                <option value="vs-dark">Dark</option>
                <option value="vs">Light</option>
                <option value="hc-black">High Contrast</option>
              </select>
            </div>

            <div className="setting-group">
              <label htmlFor="font-size-input">Font Size</label>
              <div className="font-size-controls">
                <button
                  className="icon-button"
                  onClick={() => handleFontSizeChange(-1)}
                >
                  <FaMinus />
                </button>
                <input
                  id="font-size-input"
                  type="number"
                  min="8"
                  max="30"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                />
                <button
                  className="icon-button"
                  onClick={() => handleFontSizeChange(1)}
                >
                  <FaPlus />
                </button>
              </div>
            </div>

            <button
              className="close-settings"
              onClick={() => setShowSettings(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Session;
