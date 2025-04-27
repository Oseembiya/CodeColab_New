import React from "react";
import { FaExclamationTriangle } from "react-icons/fa";

const ConfirmCloseModal = ({ cancelCloseChallenge, confirmCloseChallenge }) => {
  return (
    <div className="modal-overlay" onClick={cancelCloseChallenge}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>
          <FaExclamationTriangle style={{ color: "#ff5252" }} /> Confirm Action
        </h2>
        <p>
          Are you sure you want to abandon this challenge? Your progress will be
          lost and all participants will no longer see this challenge.
        </p>
        <div className="modal-actions">
          <button className="cancel-button" onClick={cancelCloseChallenge}>
            Cancel
          </button>
          <button
            className="submit-button"
            style={{ backgroundColor: "#ff5252" }}
            onClick={confirmCloseChallenge}
          >
            Yes, Abandon Challenge
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmCloseModal;
