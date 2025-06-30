import { Link } from "react-router-dom";
import { FaCode, FaPencilAlt, FaArrowLeft } from "react-icons/fa";
import "../styles/pages/Demo.css";

const Demo = () => {
  return (
    <div className="demo-page">
      <div className="demo-container">
        <div className="demo-header">
          <Link to="/auth" className="back-link">
            <FaArrowLeft /> Back to Login
          </Link>
          <h1>CodeColab Demo</h1>
          <p>Try our platform features without creating an account</p>
        </div>

        <div className="demo-options">
          <Link to="/standalone-editor" className="demo-option">
            <div className="demo-icon">
              <FaCode />
            </div>
            <h2>Code Editor</h2>
            <p>Write, execute, and test code with our powerful editor</p>
          </Link>

          <Link to="/standalone-whiteboard" className="demo-option">
            <div className="demo-icon">
              <FaPencilAlt />
            </div>
            <h2>Digital Whiteboard</h2>
            <p>Draw, sketch, and brainstorm on our interactive whiteboard</p>
          </Link>
        </div>

        <div className="demo-footer">
          <div className="upgrade-benefits">
            <h3>🚀 Ready to Code Together?</h3>
            <p>
              Create a free account to unlock the full CodeColab experience:
            </p>
            <ul className="benefits-list">
              <li>
                ✨ <strong>Real-time collaboration</strong> - Code with
                teammates simultaneously
              </li>
              <li>
                🎥 <strong>Built-in video chat</strong> - Discuss ideas while
                you code
              </li>
              <li>
                💾 <strong>Session management</strong> - Save and share your
                coding sessions
              </li>
              <li>
                📊 <strong>Progress tracking</strong> - Monitor your coding
                journey
              </li>
              <li>
                🔄 <strong>Live sessions</strong> - Join or host collaborative
                coding rooms
              </li>
            </ul>
          </div>
          <Link to="/auth" className="signup-cta">
            Start Collaborating Now!
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Demo;
