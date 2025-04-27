import React from "react";
import {
  FaIndent,
  FaUndo,
  FaRedo,
  FaCopy,
  FaPaste,
  FaSearch,
  FaMinus,
  FaPlus,
  FaFont,
  FaSun,
  FaMoon,
  FaFileUpload,
  FaFileDownload,
  FaEraser,
} from "react-icons/fa";

const EditorTools = ({
  handleFormatCode,
  handleUndo,
  handleRedo,
  handleCopy,
  handlePaste,
  handleFind,
  handleFontSizeChange,
  fontSize,
  handleToggleTheme,
  theme,
  handleUploadCode,
  fileInputRef,
  handleFileChange,
  handleDownloadCode,
  handleClearEditor,
}) => {
  return (
    <div className="editor-tools-bar">
      <div className="tools-group">
        <button
          className="tool-button"
          onClick={handleFormatCode}
          title="Format code"
        >
          <FaIndent />
        </button>
        <button className="tool-button" onClick={handleUndo} title="Undo">
          <FaUndo />
        </button>
        <button className="tool-button" onClick={handleRedo} title="Redo">
          <FaRedo />
        </button>
      </div>

      <div className="tools-group">
        <button className="tool-button" onClick={handleCopy} title="Copy">
          <FaCopy />
        </button>
        <button className="tool-button" onClick={handlePaste} title="Paste">
          <FaPaste />
        </button>
        <button className="tool-button" onClick={handleFind} title="Find">
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
          title={`Switch to ${theme === "vs-dark" ? "light" : "dark"} theme`}
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
  );
};

export default EditorTools;
