import React from "react";
import {
  FaTerminal,
  FaClipboard,
  FaTrash,
  FaChevronUp,
  FaChevronDown,
  FaCompress,
  FaExpand,
  FaTimes,
} from "react-icons/fa";

const OutputPanel = ({
  output,
  isOutputMinimized,
  isOutputMaximized,
  outputHeight,
  handleOutputDragStart,
  outputDragRef,
  copyOutputToClipboard,
  clearOutput,
  toggleOutputMinimize,
  toggleOutputMaximize,
  setOutput,
}) => {
  return (
    <div
      className={`output-panel ${isOutputMinimized ? "minimized" : ""} ${
        isOutputMaximized ? "maximized" : ""
      }`}
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
          <button className="output-close-button" onClick={() => setOutput("")}>
            <FaTimes />
          </button>
        </div>
      </div>
      <pre className="output-content">{output}</pre>
    </div>
  );
};

export default OutputPanel;
