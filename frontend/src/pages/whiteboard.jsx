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
  FaVideo,
} from "react-icons/fa";
import VideoChat, {
  isVideoChatActive,
  setVideoChatActive,
} from "../components/VideoChat";
import "../styles/pages/Whiteboard.css";

// Extend Fabric.js to better handle object IDs
const extendFabric = () => {
  // Extend the Fabric Object prototype to include ID in its toObject method
  fabric.Object.prototype.toObject = (function (toObject) {
    return function (propertiesToInclude) {
      // Add 'id' to the properties that should be serialized
      propertiesToInclude = (propertiesToInclude || []).concat([
        "id",
        "userId",
      ]);
      return toObject.call(this, propertiesToInclude);
    };
  })(fabric.Object.prototype.toObject);
};

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
  const initialSyncDoneRef = useRef(false);

  const [activeTool, setActiveTool] = useState("pencil");
  const [activeColor, setActiveColor] = useState("#5c5fbb");
  const [brushWidth, setBrushWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [users, setUsers] = useState([]);
  const [showVideoChat, setShowVideoChat] = useState(false);

  // Check if video chat is active for this session on mount
  useEffect(() => {
    if (sessionId && sessionId !== "new") {
      setShowVideoChat(isVideoChatActive(sessionId));
    }
  }, [sessionId]);

  // Helper function to generate a unique ID with user identifier
  const generateId = () => {
    const userId = currentUser?.uid || "anonymous";
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    return `${userId}-${timestamp}-${random}`;
  };

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
    // Extend Fabric.js functionality
    extendFabric();

    // Check if canvas already initialized
    if (fabricCanvasRef.current) {
      return;
    }

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
        // Ensure path has an ID and user ID
        const path = e.path;
        if (!path.id) {
          path.id = generateId();
        }

        // Add user ID to track who created this object
        path.userId = currentUser?.uid || "anonymous";

        // Send drawing data to server
        const pathAsJson = path.toJSON();
        socket.emit("whiteboard-draw", {
          sessionId,
          objects: [pathAsJson],
        });
      }
    });

    // Handle object modification - only send to server in collaborative mode
    canvas.on("object:modified", (e) => {
      if (socket && connected && !standalone) {
        // Ensure object has an ID and user ID
        const obj = e.target;
        if (!obj.id) {
          obj.id = generateId();
        }

        // Add user ID if not present
        if (!obj.userId) {
          obj.userId = currentUser?.uid || "anonymous";
        }

        // Send updated object to server
        const objectAsJson = obj.toJSON();
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

    // Wait a short delay to ensure canvas has properly mounted and sized
    setTimeout(() => {
      if (sessionId !== "new" && socket && connected) {
        requestWhiteboardState();
      }
    }, 500);

    // Clean up
    return () => {
      window.removeEventListener("resize", handleResize);
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, [activeColor, brushWidth, sessionId, socket, connected, currentUser]);

  // Request current whiteboard state when joining a session
  const requestWhiteboardState = () => {
    if (
      !socket ||
      !connected ||
      sessionId === "new" ||
      isUnmountingRef.current
    ) {
      return;
    }

    socket.emit("whiteboard-request-state", {
      sessionId,
    });
  };

  // Join session and setup socket listeners
  useEffect(() => {
    let isMounted = true; // Track mount status
    isUnmountingRef.current = false;
    initialSyncDoneRef.current = false;

    const initSession = async () => {
      if (!sessionId || sessionId === "new") {
        // Handle standalone mode early
        sessionInitializedRef.current = true;
        return;
      }

      // If we've already initialized this specific collaborative session, don't do it again
      if (sessionInitializedRef.current && currentSession?.id === sessionId) {
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

      // Handler for draw events from other users
      const handleWhiteboardDraw = (data) => {
        if (
          data.sessionId === sessionId &&
          fabricCanvasRef.current &&
          isMounted
        ) {
          fabric.util.enlivenObjects(data.objects, (objects) => {
            if (fabricCanvasRef.current) {
              // Double check canvas ref
              objects.forEach((obj) => {
                // Ensure the object has an ID
                if (!obj.id) {
                  obj.id = `${
                    data.user?.id || "remote"
                  }-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                }
                // Add userId if not present
                if (!obj.userId && data.user?.id) {
                  obj.userId = data.user.id;
                }
                fabricCanvasRef.current.add(obj);
              });
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

          // Check if object has an ID
          if (!data.object.id) {
            console.warn("Received object without ID:", data.object);
            return;
          }

          const targetObject = objects.find((obj) => obj.id === data.object.id);
          if (targetObject) {
            // Update properties from the received object
            targetObject.set(data.object);
            canvas.requestRenderAll();
          } else {
            // If object not found, add it as new
            fabric.util.enlivenObjects([data.object], (enlivenedObjects) => {
              if (fabricCanvasRef.current && enlivenedObjects.length > 0) {
                // Add userId if not present
                if (!enlivenedObjects[0].userId && data.user?.id) {
                  enlivenedObjects[0].userId = data.user.id;
                }
                fabricCanvasRef.current.add(enlivenedObjects[0]);
                fabricCanvasRef.current.requestRenderAll();
              }
            });
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

      // Handler for state request response
      const handleWhiteboardState = (data) => {
        if (
          data.sessionId === sessionId &&
          fabricCanvasRef.current &&
          isMounted &&
          data.objects &&
          Array.isArray(data.objects) &&
          data.objects.length > 0
        ) {
          console.log(
            "Whiteboard: Received initial state with",
            data.objects.length,
            "objects",
            data.source || ""
          );

          // Clear current canvas first
          fabricCanvasRef.current.clear();
          fabricCanvasRef.current.setBackgroundColor("#151618", () => {
            // Add all objects from the state
            fabric.util.enlivenObjects(data.objects, (objects) => {
              if (fabricCanvasRef.current && objects.length > 0) {
                objects.forEach((obj) => {
                  // Ensure each object has an ID to avoid duplicates
                  if (!obj.id) {
                    obj.id = `${
                      data.user?.id || "system"
                    }-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                  }

                  // Fix any potentially invalid attributes
                  if (
                    obj.type === "path" &&
                    (!obj.path || obj.path.length === 0)
                  ) {
                    console.warn("Skipping invalid path object", obj);
                    return;
                  }

                  try {
                    fabricCanvasRef.current.add(obj);
                  } catch (err) {
                    console.error("Error adding object to canvas:", err);
                  }
                });

                fabricCanvasRef.current.requestRenderAll();
                console.log("Successfully restored whiteboard state");
              }
            });
          });
        } else if (
          data.sessionId === sessionId &&
          data.objects &&
          Array.isArray(data.objects) &&
          data.objects.length === 0
        ) {
          console.log("Received empty whiteboard state");
        }
      };

      // Handler for user list updates
      const handleUsersUpdate = (users) => {
        if (isMounted) {
          console.log(
            "Whiteboard: Received users update, count:",
            users.length
          );
          setUsers(users);
        }
      };

      // Handler for joining a session room
      const handleJoinedSessionRoom = (data) => {
        console.log(`Successfully joined whiteboard room: ${data.sessionId}`);

        // Only request users when we've successfully joined the correct room
        if (data.sessionId === sessionId) {
          socket.emit("get-users", { sessionId });

          // Request the current whiteboard state
          setTimeout(() => {
            requestWhiteboardState();
          }, 1000);
        }
      };

      // Handler for state requests from other users
      const handleWhiteboardStateRequest = (data) => {
        if (
          data.sessionId === sessionId &&
          fabricCanvasRef.current &&
          isMounted
        ) {
          // Only respond if we're not the requester and we have a canvas with objects
          if (
            data.requestingUserId !== currentUser?.uid &&
            fabricCanvasRef.current.getObjects().length > 0
          ) {
            // Get all objects from the canvas
            const objects = fabricCanvasRef.current
              .getObjects()
              .map((obj) => obj.toJSON());

            // Send our state to the requesting user
            socket.emit("whiteboard-state-response", {
              sessionId,
              objects,
              targetSocketId: data.socketId,
            });
          }
        }
      };

      // Remove any existing listeners to avoid duplicates
      socket.off("whiteboard-draw");
      socket.off("whiteboard-update");
      socket.off("whiteboard-clear");
      socket.off("whiteboard-state");
      socket.off("whiteboard-state-request");
      socket.off("users-update");
      socket.off("joined-session-room");

      // Add fresh listeners
      socket.on("whiteboard-draw", handleWhiteboardDraw);
      socket.on("whiteboard-update", handleWhiteboardUpdate);
      socket.on("whiteboard-clear", handleWhiteboardClear);
      socket.on("whiteboard-state", handleWhiteboardState);
      socket.on("whiteboard-state-request", handleWhiteboardStateRequest);
      socket.on("users-update", handleUsersUpdate);
      socket.on("joined-session-room", handleJoinedSessionRoom);

      // Clean up function
      return () => {
        if (socket) {
          socket.off("whiteboard-draw", handleWhiteboardDraw);
          socket.off("whiteboard-update", handleWhiteboardUpdate);
          socket.off("whiteboard-clear", handleWhiteboardClear);
          socket.off("whiteboard-state", handleWhiteboardState);
          socket.off("whiteboard-state-request", handleWhiteboardStateRequest);
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
    const isOwner =
      currentSession &&
      currentUser &&
      currentSession.createdBy === currentUser.uid;

    // Check if the user is the session owner
    if (isOwner && sessionId !== "new") {
      console.log("Owner is exiting whiteboard session, marking as ended");

      // If socket is connected, emit session-ended event
      if (socket && connected) {
        console.log("Emitting session-ended event from whiteboard");
        socket.emit("end-session", {
          sessionId,
          userId: currentUser?.uid,
        });

        // Also dispatch a DOM event for LiveSessions page to listen to
        window.dispatchEvent(
          new CustomEvent("session-ended", {
            detail: { sessionId },
          })
        );
      }
    }

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
      socket.off("whiteboard-state");
      socket.off("whiteboard-state-request");
      socket.off("users-update");
      socket.off("joined-session-room");
    }

    isUnmountingRef.current = true;
    leaveSession();
    navigate("/whiteboard/new");
  };

  // Handle navigating back to code session view
  const handleGoToCodeSession = () => {
    // No need to clean up anything - we want to preserve state
    // Just navigate to the session view
    navigate(`/session/${sessionId}`);
  };

  // Toggle video chat
  const toggleVideoChat = () => {
    const newState = !showVideoChat;
    setShowVideoChat(newState);

    if (newState) {
      setVideoChatActive(sessionId);
    }
  };

  // Handle closing video chat
  const handleCloseVideoChat = () => {
    setShowVideoChat(false);
  };

  // Update canvas tool when active tool changes
  useEffect(() => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;

    // Helper function to create shapes and emit updates
    const createShapeAndEmit = (obj) => {
      // Add ID to the object
      obj.id = generateId();
      obj.userId = currentUser?.uid || "anonymous";

      canvas.add(obj);
      canvas.setActiveObject(obj);
      canvas.renderAll();

      // Emit the new object to other users if in collaborative mode
      if (socket && connected && sessionId !== "new") {
        const objJson = obj.toJSON();
        socket.emit("whiteboard-draw", {
          sessionId,
          objects: [objJson],
        });
      }
    };

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
        setIsDrawing(false);

        // Create a rectangle at center of canvas
        const rect = new fabric.Rect({
          left: canvas.width / 2 - 50,
          top: canvas.height / 2 - 50,
          width: 100,
          height: 100,
          fill: activeColor,
          stroke: activeColor,
          strokeWidth: 2,
          selectable: true,
        });

        createShapeAndEmit(rect);
        break;
      case "circle":
        canvas.isDrawingMode = false;
        setIsDrawing(false);

        // Create a circle at center of canvas
        const circle = new fabric.Circle({
          left: canvas.width / 2 - 50,
          top: canvas.height / 2 - 50,
          radius: 50,
          fill: activeColor,
          stroke: activeColor,
          strokeWidth: 2,
          selectable: true,
        });

        createShapeAndEmit(circle);
        break;
      case "text":
        canvas.isDrawingMode = false;

        // Add text
        const text = new fabric.IText("Click to edit text", {
          left: canvas.width / 2 - 75,
          top: canvas.height / 2 - 10,
          fill: activeColor,
          fontFamily: "Arial",
          fontSize: 20,
          selectable: true,
        });

        createShapeAndEmit(text);
        break;
      default:
        canvas.isDrawingMode = true;
    }
  }, [
    activeTool,
    activeColor,
    brushWidth,
    socket,
    connected,
    sessionId,
    currentUser,
  ]);

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

  // Update the getDisplayTitle function to match SessionHeader format
  const getDisplayTitle = () => {
    if (sessionId === "new") {
      return "Standalone Whiteboard";
    }

    // Check if currentSession exists and has a name/title property
    let sessionTitle = "Whiteboard: " + sessionId.substring(0, 8);

    if (currentSession) {
      const displayName = currentSession.name || currentSession.title;

      if (displayName) {
        if (displayName.startsWith("@")) {
          sessionTitle = displayName;
        } else {
          sessionTitle = `Whiteboard: ${displayName}`;
        }
      }
    }

    return sessionTitle;
  };

  // Update the document title effect to use getDisplayTitle
  useEffect(() => {
    // Set the document title based on the session
    document.title = `${getDisplayTitle()} - CodeColab`;

    // Clean up when component unmounts
    return () => {
      document.title = "CodeColab";
    };
  }, [currentSession, sessionId]);

  return (
    <div className="whiteboard-container">
      {/* Whiteboard Header */}
      <div className="whiteboard-header">
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
            <>
              <button
                className="exit-collab-button"
                onClick={handleExitCollaboration}
                title="Exit collaboration and work in standalone mode"
              >
                Exit Collaboration
              </button>
              <button
                className="video-chat-button"
                onClick={toggleVideoChat}
                title="Toggle video chat"
              >
                <FaVideo /> Video Chat
              </button>
            </>
          )}
          <Link
            to={`/session/${sessionId}`}
            className="editor-link"
            onClick={(e) => {
              e.preventDefault();
              handleGoToCodeSession();
            }}
          >
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

      {/* Video chat component */}
      {showVideoChat && sessionId !== "new" && (
        <div className="video-chat-wrapper">
          <VideoChat
            sessionId={sessionId}
            participants={users}
            onClose={handleCloseVideoChat}
          />
        </div>
      )}

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
