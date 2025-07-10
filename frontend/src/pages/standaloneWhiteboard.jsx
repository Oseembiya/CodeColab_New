import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { fabric } from "fabric";
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

const StandaloneWhiteboard = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);

  const [activeTool, setActiveTool] = useState(() => {
    return localStorage.getItem("standaloneWhiteboardTool") || "pencil";
  });
  const [activeColor, setActiveColor] = useState(() => {
    return localStorage.getItem("standaloneWhiteboardColor") || "#5c5fbb";
  });
  const [brushWidth, setBrushWidth] = useState(() => {
    const savedWidth = localStorage.getItem("standaloneWhiteboardBrushWidth");
    return savedWidth ? parseInt(savedWidth) : 3;
  });
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

  // Save canvas state to localStorage
  const saveCanvasState = () => {
    if (fabricCanvasRef.current) {
      const canvasData = fabricCanvasRef.current.toJSON();
      localStorage.setItem(
        "standaloneWhiteboardCanvas",
        JSON.stringify(canvasData)
      );
    }
  };

  // Load canvas state from localStorage
  const loadCanvasState = () => {
    const savedCanvas = localStorage.getItem("standaloneWhiteboardCanvas");
    if (savedCanvas && fabricCanvasRef.current) {
      try {
        const canvasData = JSON.parse(savedCanvas);
        fabricCanvasRef.current.loadFromJSON(canvasData, () => {
          fabricCanvasRef.current.renderAll();
          // Re-apply current tool settings after loading
          updateCanvasSettings();
        });
      } catch (error) {
        console.error("Error loading canvas state:", error);
      }
    }
  };

  // Update canvas settings based on current tool
  const updateCanvasSettings = () => {
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
        canvas.freeDrawingBrush.color = "#000000"; // Background color
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
        break;
      default:
        canvas.isDrawingMode = true;
    }
  };

  // Initialize canvas and fabric
  useEffect(() => {
    // Check if canvas already initialized
    if (fabricCanvasRef.current) {
      return;
    }

    // Create fabric canvas
    const canvas = new fabric.Canvas(canvasRef.current, {
      isDrawingMode: true,
      width: canvasRef.current.offsetWidth,
      height: canvasRef.current.offsetHeight,
      backgroundColor: "#000000",
      selection: true,
      allowTouchScrolling: true,
    });

    // Assign to ref
    fabricCanvasRef.current = canvas;

    // Set up drawing mode
    canvas.freeDrawingBrush.color = activeColor;
    canvas.freeDrawingBrush.width = brushWidth;

    // Add event listeners for saving canvas state
    canvas.on("path:created", saveCanvasState);
    canvas.on("object:added", saveCanvasState);
    canvas.on("object:removed", saveCanvasState);
    canvas.on("object:modified", saveCanvasState);

    // Load saved canvas state
    setTimeout(() => {
      loadCanvasState();
    }, 100);

    // Handle window resize
    const handleResize = () => {
      canvas.setWidth(canvasRef.current.offsetWidth);
      canvas.setHeight(canvasRef.current.offsetHeight);
      canvas.renderAll();
    };

    window.addEventListener("resize", handleResize);

    // Clean up
    return () => {
      window.removeEventListener("resize", handleResize);
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, []);

  // Update canvas tool when active tool changes
  useEffect(() => {
    updateCanvasSettings();
  }, [activeTool, activeColor, brushWidth]);

  // Handle tool selection
  const handleToolSelect = (tool) => {
    setActiveTool(tool);
    localStorage.setItem("standaloneWhiteboardTool", tool);

    if (tool === "text") {
      handleTextTool();
    }
  };

  // Handle color selection
  const handleColorSelect = (color) => {
    setActiveColor(color);
    localStorage.setItem("standaloneWhiteboardColor", color);
    if (activeTool === "eraser") {
      setActiveTool("pencil");
      localStorage.setItem("standaloneWhiteboardTool", "pencil");
    }
  };

  // Handle brush size change
  const handleBrushSizeChange = (e) => {
    const newWidth = parseInt(e.target.value);
    setBrushWidth(newWidth);
    localStorage.setItem("standaloneWhiteboardBrushWidth", newWidth.toString());
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
      fabricCanvasRef.current.setBackgroundColor("#000000", () => {
        fabricCanvasRef.current.renderAll();
        // Clear saved canvas state
        localStorage.removeItem("standaloneWhiteboardCanvas");
      });
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
      link.download = "standalone-whiteboard.png";
      link.click();
    }
  };

  // Handle text tool specifically
  const handleTextTool = () => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;
    canvas.isDrawingMode = false;

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
  };

  // Rectangle drawing logic
  const handleCanvasMouseDown = (options) => {
    if (activeTool === "rectangle") {
      const canvas = fabricCanvasRef.current;
      const pointer = canvas.getPointer(options.e);
      const rect = new fabric.Rect({
        left: pointer.x,
        top: pointer.y,
        width: 1,
        height: 1,
        fill: "transparent",
        stroke: activeColor,
        strokeWidth: brushWidth,
      });
      canvas.add(rect);
      canvas.setActiveObject(rect);
    } else if (activeTool === "circle") {
      const canvas = fabricCanvasRef.current;
      const pointer = canvas.getPointer(options.e);
      const circle = new fabric.Circle({
        left: pointer.x,
        top: pointer.y,
        radius: 1,
        fill: "transparent",
        stroke: activeColor,
        strokeWidth: brushWidth,
      });
      canvas.add(circle);
      canvas.setActiveObject(circle);
    }
  };

  return (
    <div className="whiteboard-container">
      {/* Whiteboard Header */}
      <div className="whiteboard-header">
        <div className="header-left">
          <h1>Whiteboard</h1>
          <div className="connection-status">
            <span className="status-indicator standalone"></span>
            Standalone Mode
          </div>
        </div>

        <div className="header-right">
          <Link to="/standalone-editor" className="editor-link">
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

export default StandaloneWhiteboard;
