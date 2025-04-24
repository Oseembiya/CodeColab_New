import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  FaUsers,
  FaCode,
  FaLightbulb,
  FaLaptopCode,
  FaComments,
  FaChalkboardTeacher,
  FaRocket,
  FaChartLine,
  FaUserFriends,
  FaPuzzlePiece,
  FaFileCode,
  FaClock,
  FaHandshake,
  FaPencilAlt,
} from "react-icons/fa";
import { useSession } from "../contexts/SessionContext";
import { useUserMetrics } from "../contexts/UserMetricsContext";
import { useSocket } from "../contexts/SocketContext";
import "../styles/pages/Dashboard.css";

// Placeholder component for the session creation modal
const CreateSessionModal = ({ isQuickStart, onClose, onSubmit }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("javascript");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      title,
      description,
      language,
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{isQuickStart ? "Quick Start Session" : "Create New Session"}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="title">Session Title</label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title for your session"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="description">Description (optional)</label>
            <input
              type="text"
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the session"
            />
          </div>
          <div className="form-group">
            <label htmlFor="language">Programming Language</label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="csharp">C#</option>
              <option value="cpp">C++</option>
            </select>
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="button alternative"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="button">
              Create Session
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { createSession } = useSession();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isQuickStart, setIsQuickStart] = useState(false);

  const [greeting] = useState(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  });

  const { metrics, loading: metricsLoading } = useUserMetrics();
  const { socket } = useSocket();

  // Add this state for platform metrics
  const [localPlatformStats, setLocalPlatformStats] = useState({
    activeSessions: 0,
    collaboratingUsers: 0,
    codeLinesSynced: "0",
  });

  // Handle the "Get Started Now" button click
  const handleGetStarted = () => {
    setIsQuickStart(true);
    setShowCreateModal(true);
  };

  // Handle the "Create Your First Session" button click
  const handleCreateFirstSession = () => {
    setIsQuickStart(false);
    setShowCreateModal(true);
  };

  // Handle session creation submission
  const handleCreateSession = async (sessionData) => {
    try {
      const sessionId = await createSession(sessionData);
      setShowCreateModal(false);
      // Navigate to the newly created session
      navigate(`/session/${sessionId}`);
    } catch (error) {
      console.error("Failed to create session:", error);
      // Handle error (you might want to show this to the user)
    }
  };

  // Fetch platform statistics from the server
  useEffect(() => {
    if (socket) {
      socket.emit("request-global-stats");

      // Handle incoming global stats
      socket.on("global-stats", (stats) => {
        // Format the total lines of code for display
        let formattedLineCount = "0";
        if (stats.totalLinesOfCode) {
          if (stats.totalLinesOfCode > 1000000) {
            formattedLineCount = `${
              Math.round(stats.totalLinesOfCode / 100000) / 10
            }M`;
          } else if (stats.totalLinesOfCode > 1000) {
            formattedLineCount = `${
              Math.round(stats.totalLinesOfCode / 100) / 10
            }K`;
          } else {
            formattedLineCount = stats.totalLinesOfCode.toString();
          }
        }

        // Store platform stats directly in local component state
        setLocalPlatformStats({
          activeSessions: stats.activeSessions || 0,
          collaboratingUsers: stats.collaboratingUsers || 0,
          codeLinesSynced: formattedLineCount,
        });
      });

      return () => {
        socket.off("global-stats");
      };
    }
  }, [socket]);

  // User's personal stats section
  const renderPersonalStats = () => {
    if (metricsLoading) {
      return <div className="loading-stats">Loading your stats...</div>;
    }

    if (!metrics) return null;

    return (
      <div className="personal-stats-container">
        <h2 className="section-title">Your Activity</h2>
        <div className="stats-container">
          <div className="stat-item">
            <div className="stat-icon">
              <FaUsers />
            </div>
            <h3>{metrics.totalSessions || 0}</h3>
            <p>Your Sessions</p>
          </div>
          <div className="stat-item">
            <div className="stat-icon">
              <FaClock />
            </div>
            <h3>
              {metrics.hoursSpent
                ? Math.round(metrics.hoursSpent * 10) / 10
                : 0}
            </h3>
            <p>Hours Spent</p>
          </div>
          <div className="stat-item">
            <div className="stat-icon">
              <FaFileCode />
            </div>
            <h3>{metrics.linesOfCode || 0}</h3>
            <p>Lines Written</p>
          </div>
          <div className="stat-item">
            <div className="stat-icon">
              <FaHandshake />
            </div>
            <h3>{metrics.collaborations || 0}</h3>
            <p>Collaborations</p>
          </div>
        </div>
      </div>
    );
  };

  // Key features
  const keyFeatures = [
    {
      icon: <FaLaptopCode />,
      title: "Real-time Code Editor",
      description:
        "Collaborate on code in real-time with syntax highlighting and auto-completion",
    },
    {
      icon: <FaLightbulb />,
      title: "Interactive Whiteboard",
      description:
        "Visualize concepts and brainstorm solutions with our integrated whiteboard",
    },
    {
      icon: <FaComments />,
      title: "Seamless Communication",
      description: "Stay connected with built-in video and text communication",
    },
  ];

  // Benefits
  const benefits = [
    {
      icon: <FaUsers />,
      title: "Enhance Remote Collaboration",
      description:
        "CodeColab eliminates the need for multiple tools by providing an all-in-one platform",
    },
    {
      icon: <FaChalkboardTeacher />,
      title: "Improve Learning Experience",
      description: "Perfect for teaching, learning, and pair programming",
    },
    {
      icon: <FaChartLine />,
      title: "Streamline Development",
      description:
        "From ideation to implementation, all in one seamless workflow",
    },
  ];

  // Testimonials section - remove dummy testimonials
  const testimonials = [];

  return (
    <div className="dashboard-container">
      {/* Welcome/Introduction Section - Now at the top */}
      <div className="intro-section">
        <div className="intro-card">
          <h1>{greeting}, Welcome to CodeColab</h1>
          <p>Your collaborative coding platform</p>
        </div>
      </div>

      {/* Main content - Now below intro section */}
      <h2>CodeColab</h2>
      <p className="tagline">Where Code Collaboration Meets Creativity</p>
      <p className="description">
        CodeColab is a seamless, real-time collaborative coding platform that
        integrates an interactive whiteboard and built-in communication
        features. Our goal is to enhance productivity by reducing the need for
        external tools and ensuring synchronized, efficient collaboration.
      </p>
      <button className="get-started-btn" onClick={handleGetStarted}>
        <FaRocket />
        <span>Get Started Now</span>
      </button>

      {/* User's Personal Stats Section */}
      {renderPersonalStats()}

      {/* Key Features Section */}
      <h2 className="section-title">Key Features</h2>
      <div className="features-grid">
        {keyFeatures.map((feature, index) => (
          <div key={index} className="feature-card">
            <div className="feature-icon">{feature.icon}</div>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </div>
        ))}
      </div>

      {/* Platform Stats */}
      <h2 className="section-title">Platform Activity</h2>
      <div className="stats-container">
        <div className="stat-item">
          <div className="stat-icon">
            <FaCode />
          </div>
          <h3>{localPlatformStats.activeSessions || 0}</h3>
          <p>Active Sessions</p>
        </div>
        <div className="stat-item">
          <div className="stat-icon">
            <FaUsers />
          </div>
          <h3>{localPlatformStats.collaboratingUsers || 0}</h3>
          <p>Users Collaborating Now</p>
        </div>
        <div className="stat-item">
          <div className="stat-icon">
            <FaFileCode />
          </div>
          <h3>{localPlatformStats.codeLinesSynced || "0"}</h3>
          <p>Code Lines Synced</p>
        </div>
      </div>

      {/* Benefits Section */}
      <h2 className="section-title">Why Choose CodeColab?</h2>
      <div className="benefits-grid">
        {benefits.map((benefit, index) => (
          <div key={index} className="benefit-card">
            <div className="benefit-icon">{benefit.icon}</div>
            <h3>{benefit.title}</h3>
            <p>{benefit.description}</p>
          </div>
        ))}
      </div>

      {/* Quick Start Guide */}
      <h2 className="section-title">Quick Start Guide</h2>
      <div className="quick-start">
        <div className="quick-start-steps">
          <div className="step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h3>Create or Join a Session</h3>
              <p>
                Start a new coding session or join an existing one with a simple
                click
              </p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h3>Invite Collaborators</h3>
              <p>
                Share your session link with team members to collaborate in
                real-time
              </p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h3>Code, Draw, Communicate</h3>
              <p>
                Use the integrated tools to code, visualize ideas, and discuss
                with your team
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Featured Use Cases */}
      <h2 className="section-title">Perfect For</h2>
      <div className="use-cases-grid">
        <div className="use-case-card">
          <div className="use-case-icon">
            <FaUserFriends />
          </div>
          <h3>Remote Teams</h3>
          <p>Collaborate seamlessly across time zones and locations</p>
        </div>
        <div className="use-case-card">
          <div className="use-case-icon">
            <FaChalkboardTeacher />
          </div>
          <h3>Educators & Students</h3>
          <p>Create interactive coding lessons and pair programming sessions</p>
        </div>
        <div className="use-case-card">
          <div className="use-case-icon">
            <FaPuzzlePiece />
          </div>
          <h3>Technical Interviews</h3>
          <p>
            Conduct effective live coding interviews with real-time feedback
          </p>
        </div>
      </div>

      {/* Testimonials */}
      <h2 className="section-title">What Our Users Say</h2>
      <div className="testimonials">
        {testimonials.map((testimonial, index) => (
          <div key={index} className="testimonial-card">
            <p className="quote">&ldquo;{testimonial.quote}&rdquo;</p>
            <p className="author">— {testimonial.author}</p>
          </div>
        ))}
      </div>

      {/* Call to Action */}
      <div className="cta-section">
        <h2>Ready to Start Coding?</h2>
        <p>Get straight to work with our powerful tools</p>
        <div className="cta-buttons">
          {/* Create new session button */}
          <button className="cta-button" onClick={handleCreateFirstSession}>
            <FaRocket /> Create New Collaborative Session
          </button>

          <div className="or-divider">or</div>

          {/* Standalone mode options */}
          <div className="standalone-options">
            <h3>Start in Standalone Mode</h3>
            <p>Work by yourself with no session management</p>
            <div className="standalone-buttons">
              <Link to="/standalone-editor" className="standalone-button">
                <FaCode /> Code Editor
              </Link>
              <Link to="/whiteboard/new" className="standalone-button">
                <FaPencilAlt /> Whiteboard
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Create Session Modal */}
      {showCreateModal && (
        <CreateSessionModal
          isQuickStart={isQuickStart}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateSession}
        />
      )}
    </div>
  );
};

export default Dashboard;
