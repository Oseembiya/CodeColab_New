import React from "react";
import { FaMinus, FaPlus } from "react-icons/fa";

const SettingsPanel = ({
  setShowSettings,
  theme,
  setTheme,
  fontSize,
  setFontSize,
  handleFontSizeChange,
}) => {
  return (
    <div className="settings-overlay" onClick={() => setShowSettings(false)}>
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
  );
};

export default SettingsPanel;
