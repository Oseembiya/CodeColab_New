import React from "react";
import { FaPuzzlePiece } from "react-icons/fa";

const ChallengeModal = ({
  setShowChallengeModal,
  handleSelectChallenge,
  currentChallenge,
  challenges,
  setCurrentChallenge,
}) => {
  return (
    <div className="modal-overlay" onClick={() => setShowChallengeModal(false)}>
      <div className="challenge-modal" onClick={(e) => e.stopPropagation()}>
        <h2>
          <FaPuzzlePiece /> Select Coding Challenge
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSelectChallenge();
          }}
        >
          <div className="modal-input-group">
            <label htmlFor="challenge-select">Select Challenge</label>
            <select
              id="challenge-select"
              value={currentChallenge?.id || ""}
              onChange={(e) => {
                const selectedChallenge = challenges.find(
                  (c) => c.id === e.target.value
                );
                if (selectedChallenge) {
                  setCurrentChallenge(selectedChallenge);
                }
              }}
            >
              <option value="">Select a challenge</option>
              {challenges.map((challenge) => (
                <option key={challenge.id} value={challenge.id}>
                  {challenge.title}
                </option>
              ))}
            </select>
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="cancel-button"
              onClick={() => setShowChallengeModal(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="submit-button"
              disabled={!currentChallenge}
            >
              Select Challenge
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChallengeModal;
