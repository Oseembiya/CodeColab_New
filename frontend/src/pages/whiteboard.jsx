import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { fabric } from "fabric";
import { useSession } from "../contexts/SessionContext";
import { useSocket } from "../contexts/SocketContext";
import { useAuth } from "../contexts/AuthContext";
import {
  FaPencilAlt,
  FaEraser,
  FaSquare,
  FaCircle,
  FaFont,
  FaArrowsAlt,
  FaTrash,
  FaPalette,
  FaSave,
  FaCode,
  FaExclamationTriangle,
} from "react-icons/fa";
import "../styles/pages/Whiteboard.css";

const Whiteboard = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { joinSession, leaveSession, currentSession, getSessionCode } =
    useSession();
  const { socket, connected, authenticate, authenticatedRef } = useSocket();

  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const isUnmountingRef = useRef(false);
  const sessionInitializedRef = useRef(false);

  const [activeTool, setActiveTool] = useState("pencil");
  const [activeColor, setActiveColor] = useState("#5c5fbb");
  const [brushWidth, setBrushWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Colors palette
  const colors = [
    "#5c5fbb",
    "#FFFFFF",
    "#FF5252",
    "#4CAF50",
    "#FFC107",
    "#2196F3",
  ];

  // Initialize canvas and fabric
  useEffect(() => {
    // Check if canvas already initialized
    if (fabricCanvasRef.current) {
      return;
    }

    console.log("Initializing whiteboard canvas");
    const canvas = new fabric.Canvas(canvasRef.current, {
      isDrawingMode: true,
      width: canvasRef.current.offsetWidth,
      height: canvasRef.current.offsetHeight,
      backgroundColor: "#151618",
      selection: true,
    });

    // Assign to ref
    fabricCanvasRef.current = canvas;

    // Set up drawing mode
    canvas.freeDrawingBrush.color = activeColor;
    canvas.freeDrawingBrush.width = brushWidth;

    // Check if we're in standalone mode
    const standalone = sessionId === "new";

    // Handle drawing events - only send to server in collaborative mode
    canvas.on("path:created", (e) => {
      if (socket && connected && !standalone) {
        // Send drawing data to server
        const pathAsJson = e.path.toJSON();
        console.log("Sending whiteboard-draw event:", pathAsJson.type);
        socket.emit("whiteboard-draw", {
          sessionId,
          objects: [pathAsJson],
        });
      }
    });

    // Handle object modification - only send to server in collaborative mode
    canvas.on("object:modified", (e) => {
      if (socket && connected && !standalone) {
        // Send updated object to server
        const objectAsJson = e.target.toJSON();
        console.log("Sending whiteboard-update event:", objectAsJson.type);
        socket.emit("whiteboard-update", {
          sessionId,
          object: objectAsJson,
        });
      }
    });

    // Handle window resize
    const handleResize = () => {
      if (canvasRef.current && fabricCanvasRef.current) {
        fabricCanvasRef.current.setWidth(canvasRef.current.offsetWidth);
        fabricCanvasRef.current.setHeight(canvasRef.current.offsetHeight);
        fabricCanvasRef.current.renderAll();
      }
    };

    window.addEventListener("resize", handleResize);

    // Clean up
    return () => {
      window.removeEventListener("resize", handleResize);
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, [activeColor, brushWidth, sessionId, socket, connected]);

  // Join session and setup socket listeners
  useEffect(() => {
    let isMounted = true; // Track mount status
    isUnmountingRef.current = false;

    const initSession = async () => {
      if (!sessionId || sessionId === "new") {
        // Handle standalone mode early
        sessionInitializedRef.current = true;
        return;
      }

      // If we've already initialized this specific collaborative session, don't do it again
      if (sessionInitializedRef.current && currentSession?.id === sessionId) {
        console.log("Whiteboard: Session already initialized:", sessionId);
        return;
      }

      console.log("Whiteboard: Initializing session:", sessionId);
      sessionInitializedRef.current = true; // Mark as initialized

      try {
        // This will join the same session - any existing code will be preserved in the session context
        await joinSession(sessionId);

        if (socket && isMounted) {
          // Check isMounted before using socket
          console.log("Whiteboard: Setting up socket listeners for", sessionId);
          socket.emit("join-session", sessionId);

          if (currentUser) {
            authenticate({
              sessionId,
              user: currentUser,
            });
          }
        }
      } catch (error) {
        console.error("Failed to join session:", error);
        if (isMounted) navigate("/whiteboard/new");
      }
    };

    initSession();

    // Setup whiteboard socket listeners
    const setupWhiteboardListeners = () => {
      if (!socket || !connected || sessionId === "new") return;

      console.log("Setting up whiteboard socket listeners");

      // Handler for draw events from other users
      const handleWhiteboardDraw = (data) => {
        if (
          data.sessionId === sessionId &&
          fabricCanvasRef.current &&
          isMounted
        ) {
          console.log(
            "Whiteboard: Received draw event",
            data.objects.length,
            "objects from user",
            data.user?.id
          );
          fabric.util.enlivenObjects(data.objects, (objects) => {
            if (fabricCanvasRef.current) {
              // Double check canvas ref
              objects.forEach((obj) => fabricCanvasRef.current.add(obj));
              fabricCanvasRef.current.requestRenderAll(); // Use requestRenderAll for better perf
            }
          });
        }
      };

      // Handler for update events from other users
      const handleWhiteboardUpdate = (data) => {
        if (
          data.sessionId === sessionId &&
          fabricCanvasRef.current &&
          isMounted
        ) {
          console.log(
            "Whiteboard: Received update event from user",
            data.user?.id
          );
          const canvas = fabricCanvasRef.current;
          const objects = canvas.getObjects();
          const targetObject = objects.find((obj) => obj.id === data.object.id);
          if (targetObject) {
            targetObject.set(data.object);
            canvas.requestRenderAll();
          }
        }
      };

      // Handler for clear events from other users
      const handleWhiteboardClear = (data) => {
        if (
          data.sessionId === sessionId &&
          fabricCanvasRef.current &&
          isMounted
        ) {
          console.log(
            "Whiteboard: Received clear event from user",
            data.user?.id
          );
          fabricCanvasRef.current.clear();
          fabricCanvasRef.current.setBackgroundColor("#151618", () => {
            fabricCanvasRef.current.requestRenderAll();
          });
        }
      };

      // Handler for user list updates
      const handleUsersUpdate = (users) => {
        if (isMounted) {
          console.log(
            "Whiteboard: Received users update, count:",
            users.length
          );
        }
      };

      // Handler for joining a session room
      const handleJoinedSessionRoom = (data) => {
        console.log(`Successfully joined whiteboard room: ${data.sessionId}`);

        // Only request users when we've successfully joined the correct room
        if (data.sessionId === sessionId) {
          socket.emit("get-users", { sessionId });
        }
      };

      // Remove any existing listeners to avoid duplicates
      socket.off("whiteboard-draw");
      socket.off("whiteboard-update");
      socket.off("whiteboard-clear");
      socket.off("users-update");
      socket.off("joined-session-room");

      // Add fresh listeners
      socket.on("whiteboard-draw", handleWhiteboardDraw);
      socket.on("whiteboard-update", handleWhiteboardUpdate);
      socket.on("whiteboard-clear", handleWhiteboardClear);
      socket.on("users-update", handleUsersUpdate);
      socket.on("joined-session-room", handleJoinedSessionRoom);

      // Clean up function
      return () => {
        if (socket) {
          socket.off("whiteboard-draw", handleWhiteboardDraw);
          socket.off("whiteboard-update", handleWhiteboardUpdate);
          socket.off("whiteboard-clear", handleWhiteboardClear);
          socket.off("users-update", handleUsersUpdate);
          socket.off("joined-session-room", handleJoinedSessionRoom);
        }
      };
    };

    // Set up socket listeners when authenticated and connected
    const cleanupListeners = setupWhiteboardListeners();

    return () => {
      isMounted = false;
      isUnmountingRef.current = true;
      console.log("Whiteboard: Cleaning up effect for session", sessionId);

      // Clean up socket listeners
      if (cleanupListeners) cleanupListeners();

      // Don't leave the session when switching between session and whiteboard
      // Only needed for truly disconnecting, which is handled in handleExitCollaboration
    };
  }, [
    sessionId,
    socket,
    connected,
    currentUser,
    joinSession,
    authenticate,
    navigate,
    authenticatedRef,
    currentSession,
  ]);

  // Exit collaboration mode and switch to standalone mode
  const handleExitCollaboration = () => {
    if (socket && connected) {
      // Notify server that user is intentionally leaving the session
      console.log(`Emitting leave-session for session ${sessionId}`);
      socket.emit("leave-session", {
        sessionId,
        userId: currentUser?.uid,
      });

      // Remove socket listeners
      socket.off("whiteboard-draw");
      socket.off("whiteboard-update");
      socket.off("whiteboard-clear");
      socket.off("users-update");
      socket.off("joined-session-room");
    }

    isUnmountingRef.current = true;
    leaveSession();
    navigate("/whiteboard/new");
  };

  // Update canvas tool when active tool changes
  useEffect(() => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;

    switch (activeTool) {
      case "pencil":
        canvas.isDrawingMode = true;
        canvas.freeDrawingBrush.color = activeColor;
        canvas.freeDrawingBrush.width = brushWidth;
        break;
      case "eraser":
        canvas.isDrawingMode = true;
        canvas.freeDrawingBrush.color = "#151618"; // Background color
        canvas.freeDrawingBrush.width = brushWidth * 3;
        break;
      case "select":
        canvas.isDrawingMode = false;
        break;
      case "rectangle":
        canvas.isDrawingMode = false;
        setIsDrawing(true);
        break;
      case "circle":
        canvas.isDrawingMode = false;
        setIsDrawing(true);
        break;
      case "text":
        canvas.isDrawingMode = false;
        // Add text
        const text = new fabric.IText("Click to edit text", {
          left: canvas.width / 2,
          top: canvas.height / 2,
          fill: activeColor,
          fontFamily: "Arial",
          fontSize: 20,
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        canvas.renderAll();
        break;
      default:
        canvas.isDrawingMode = true;
    }
  }, [activeTool, activeColor, brushWidth]);

  // Handle tool selection
  const handleToolSelect = (tool) => {
    setActiveTool(tool);
  };

  // Handle color selection
  const handleColorSelect = (color) => {
    setActiveColor(color);
    if (activeTool === "eraser") {
      setActiveTool("pencil");
    }
  };

  // Handle brush size change
  const handleBrushSizeChange = (e) => {
    setBrushWidth(parseInt(e.target.value));
  };

  // Handle canvas clear
  const handleClearCanvas = () => {
    if (fabricCanvasRef.current) {
      setShowConfirmModal(true);
    }
  };

  const confirmClearCanvas = () => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.clear();
      fabricCanvasRef.current.setBackgroundColor("#151618", () => {
        fabricCanvasRef.current.renderAll();
      });

      // Notify others - only in collaborative mode
      if (socket && connected && sessionId !== "new") {
        socket.emit("whiteboard-clear", {
          sessionId,
        });
      }

      setShowConfirmModal(false);
    }
  };

  const cancelClearCanvas = () => {
    setShowConfirmModal(false);
  };

  // Handle save canvas
  const handleSaveCanvas = () => {
    if (fabricCanvasRef.current) {
      const dataURL = fabricCanvasRef.current.toDataURL({
        format: "png",
        multiplier: 2,
      });

      // Create download link
      const link = document.createElement("a");
      link.href = dataURL;
      link.download = `whiteboard-${sessionId.substring(0, 8)}.png`;
      link.click();
    }
  };

  return (
    <div className="whiteboard-container">
      {/* Whiteboard Header */}
      <div className="whiteboard-header">
        <div className="header-left">
          <h1>
            {sessionId === "new"
              ? "Standalone Whiteboard"
              : `Whiteboard: ${sessionId.substring(0, 8)}`}
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
          <Link to={`/session/${sessionId}`} className="editor-link">
            <FaCode /> Code Editor
          </Link>
          <button className="save-button" onClick={handleSaveCanvas}>
            <FaSave /> Save Image
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="tools">
          <button
            className={`tool-button ${activeTool === "pencil" ? "active" : ""}`}
            onClick={() => handleToolSelect("pencil")}
            title="Pencil"
          >
            <FaPencilAlt />
          </button>
          <button
            className={`tool-button ${activeTool === "eraser" ? "active" : ""}`}
            onClick={() => handleToolSelect("eraser")}
            title="Eraser"
          >
            <FaEraser />
          </button>
          <button
            className={`tool-button ${
              activeTool === "rectangle" ? "active" : ""
            }`}
            onClick={() => handleToolSelect("rectangle")}
            title="Rectangle"
          >
            <FaSquare />
          </button>
          <button
            className={`tool-button ${activeTool === "circle" ? "active" : ""}`}
            onClick={() => handleToolSelect("circle")}
            title="Circle"
          >
            <FaCircle />
          </button>
          <button
            className={`tool-button ${activeTool === "text" ? "active" : ""}`}
            onClick={() => handleToolSelect("text")}
            title="Text"
          >
            <FaFont />
          </button>
          <button
            className={`tool-button ${activeTool === "select" ? "active" : ""}`}
            onClick={() => handleToolSelect("select")}
            title="Select"
          >
            <FaArrowsAlt />
          </button>
          <button
            className="tool-button danger"
            onClick={handleClearCanvas}
            title="Clear All"
          >
            <FaTrash />
          </button>
        </div>

        <div className="brush-controls">
          <div className="brush-size">
            <span>Size:</span>
            <input
              type="range"
              min="1"
              max="20"
              value={brushWidth}
              onChange={handleBrushSizeChange}
            />
            <span>{brushWidth}px</span>
          </div>

          <div className="color-palette">
            <FaPalette className="palette-icon" />
            {colors.map((color) => (
              <button
                key={color}
                className={`color-button ${
                  activeColor === color ? "active" : ""
                }`}
                style={{ backgroundColor: color }}
                onClick={() => handleColorSelect(color)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Canvas container */}
      <div className="canvas-container">
        <canvas ref={canvasRef} />
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="confirm-modal-overlay">
          <div className="confirm-modal">
            <div className="confirm-modal-header">
              <FaExclamationTriangle />
              <h3>Clear Whiteboard</h3>
            </div>
            <div className="confirm-modal-content">
              <p>Are you sure you want to clear the entire whiteboard?</p>
              <p>This action cannot be undone.</p>
            </div>
            <div className="confirm-modal-actions">
              <button
                className="confirm-cancel-button"
                onClick={cancelClearCanvas}
              >
                Cancel
              </button>
              <button
                className="confirm-delete-button"
                onClick={confirmClearCanvas}
              >
                Clear Whiteboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Whiteboard;
