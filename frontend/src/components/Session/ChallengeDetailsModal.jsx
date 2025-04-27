import React from "react";
import { FaLightbulb, FaInfoCircle, FaTimes } from "react-icons/fa";

const ChallengeDetailsModal = ({
  currentChallenge,
  setShowChallengeDetailsModal,
  handleCloseChallenge,
}) => {
  return (
    <div
      className="modal-overlay"
      onClick={() => setShowChallengeDetailsModal(false)}
    >
      <div
        className="challenge-details-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="challenge-details-header">
          <div className="challenge-details-title">
            <FaLightbulb />
            <h2>{currentChallenge.title}</h2>
            <span
              className={`difficulty-badge ${currentChallenge.difficulty.toLowerCase()}`}
            >
              {currentChallenge.difficulty}
            </span>
          </div>
          <button
            className="close-modal-button"
            onClick={() => setShowChallengeDetailsModal(false)}
            title="Close details"
          >
            <FaTimes />
          </button>
        </div>
        <div className="challenge-details-content">
          <div className="challenge-description-area">
            <h3>
              <FaInfoCircle /> Challenge Description
            </h3>
            <p>{currentChallenge.description}</p>
          </div>

          <div className="challenge-actions">
            <button
              className="remove-challenge-button"
              onClick={handleCloseChallenge}
            >
              Abandon Challenge
            </button>
            <button
              className="close-details-button"
              onClick={() => setShowChallengeDetailsModal(false)}
            >
              Continue Coding
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChallengeDetailsModal;
