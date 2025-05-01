import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaPlus,
  FaUsers,
  FaClock,
  FaLock,
  FaUnlock,
  FaTh,
  FaList,
  FaSync,
  FaSearch,
  FaUserPlus,
} from "react-icons/fa";
import { useSession } from "../contexts/SessionContext";
import { useAuth } from "../contexts/AuthContext";
import "../styles/pages/LiveSessions.css";

// Filter options for dropdowns
const STATUS_OPTIONS = ["All Status", "Active", "Ended"];
const LANGUAGE_OPTIONS = [
  "All Languages",
  "JavaScript",
  "Python",
  "Java",
  "C#",
  "C++",
];
const TIME_OPTIONS = ["All Time", "Last Hour", "Today", "This Week"];
const SESSION_TYPE_OPTIONS = [
  "All Sessions",
  "My Sessions",
  "Public",
  "Private",
];

// Session Card Component
const SessionCard = ({ session, onJoin, onViewDetails }) => {
  const formatTime = (date) => {
    return date.toLocaleString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Check if session is private or ended
  const isDisabled = session.status === "ended" || !session.isPublic;
  // Get the appropriate button text based on session status and privacy
  const buttonText =
    session.status === "ended"
      ? "Completed"
      : !session.isPublic
      ? "Private Session"
      : "Join Session";

  // Helper function to get participant count
  const getParticipantCount = () => {
    if (!session.participants) return 0;

    if (Array.isArray(session.participants)) {
      return session.participants.length;
    }

    if (typeof session.participants === "object") {
      return Object.keys(session.participants).length;
    }

    if (typeof session.participants === "number") {
      return session.participants;
    }

    return session.participantCount || 1; // Default to 1 if none of the above
  };

  // Get display status - default to "active" if no status
  const displayStatus = session.status || "active";

  return (
    <div className="session-card">
      <div className="session-headers">
        <h3>{session.name || session.title || "Untitled Session"}</h3>
        <span className={`status-tag ${displayStatus}`}>{displayStatus}</span>
      </div>

      <div className="session-description">{session.description}</div>

      <div className="session-details">
        <div className="detail-item">
          <FaClock /> {formatTime(session.createdAt)}
        </div>
        <div className="detail-item">
          <FaUsers /> {getParticipantCount()} Participated
        </div>
        <div className="detail-item language">
          <code>{session.language}</code>
        </div>
        <div className="detail-item visibility">
          {session.isPublic ? (
            <>
              <FaUnlock /> Public
            </>
          ) : (
            <>
              <FaLock /> Private
            </>
          )}
        </div>
      </div>

      <div className="session-actions">
        <button
          className={`session-action-button ${isDisabled ? "disabled" : ""}`}
          onClick={() => !isDisabled && onJoin(session.id)}
          disabled={isDisabled}
          title={
            session.status === "ended"
              ? "This session has ended"
              : !session.isPublic
              ? "Private sessions require a code to join. Use 'Join with Code' button above."
              : "Join this session"
          }
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
};

// Join Private Session Modal
const JoinPrivateSessionModal = ({ onClose, onJoin }) => {
  const [sessionCode, setSessionCode] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!sessionCode.trim()) {
      setError("Please enter a session code");
      return;
    }
    onJoin(sessionCode);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Join Private Session</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="sessionCode">Session Code</label>
            <input
              type="text"
              id="sessionCode"
              value={sessionCode}
              onChange={(e) => setSessionCode(e.target.value)}
              placeholder="Enter the session code"
              required
            />
            <small className="input-help">
              The host can share the session code with you
            </small>
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
              Join Session
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Create Session Modal (reused from Dashboard)
const CreateSessionModal = ({ onClose, onSubmit }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [isPublic, setIsPublic] = useState(true);
  const [sessionCreated, setSessionCreated] = useState(false);
  const [sessionCode, setSessionCode] = useState("");
  const [sessionId, setSessionId] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      title,
      description,
      language,
      isPublic,
      onSessionCreated: (code, id) => {
        setSessionCode(code);
        setSessionId(id);
        setSessionCreated(true);
      },
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        {!sessionCreated ? (
          <>
            <h2>Create New Session</h2>
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
                  maxLength={24}
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
                  maxLength={24}
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
                  <option value="C++">C++</option>
                </select>
              </div>
              <div className="form-group">
                <label className="checkbox-labels">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                  />
                  Make this session public
                </label>
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
          </>
        ) : (
          <div className="session-created-info">
            <h2>Session Created!</h2>
            <p>Your session has been created successfully.</p>

            {!isPublic && (
              <div className="session-code-container">
                <h3>Session Code</h3>
                <p className="session-code">{sessionCode}</p>
                <p className="code-instructions">
                  Share this code with others to invite them to your session.
                </p>
                <button
                  className="copy-code-button"
                  onClick={() => {
                    navigator.clipboard.writeText(sessionCode);
                    alert("Session code copied to clipboard!");
                  }}
                >
                  Copy Code
                </button>
              </div>
            )}

            <div className="modal-actions">
              <button
                className="button"
                onClick={() => {
                  onClose();
                  navigate(`/session/${sessionId}`);
                }}
              >
                Continue to Session
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Main LiveSessions Component
const LiveSessions = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const {
    createSession,
    joinSession,
    sessions: userSessions,
    publicSessions: allSessions,
    loading: userSessionsLoading,
    allSessionsLoading,
    refreshSessions,
    refreshAllSessions,
  } = useSession();

  // State for combined sessions and filters
  const [allFilteredSessions, setAllFilteredSessions] = useState([]);
  const [filteredSessions, setFilteredSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [languageFilter, setLanguageFilter] = useState("All Languages");
  const [timeFilter, setTimeFilter] = useState("All Time");
  const [sessionTypeFilter, setSessionTypeFilter] = useState("All Sessions");

  // UI states
  const [viewMode, setViewMode] = useState("grid"); // 'grid' or 'list'
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Combine user sessions and all sessions, removing duplicates
  useEffect(() => {
    setIsLoading(userSessionsLoading || allSessionsLoading);

    if (!userSessionsLoading && !allSessionsLoading) {
      // Create a map of sessions by ID to remove duplicates
      const sessionsMap = new Map();

      // Add user sessions first
      userSessions.forEach((session) => {
        sessionsMap.set(session.id, {
          ...session,
          isMine: true,
          // Ensure name is always available
          name: session.name || session.title || "Untitled Session",
        });
      });

      // Add all sessions, but don't overwrite user sessions
      allSessions.forEach((session) => {
        if (!sessionsMap.has(session.id)) {
          sessionsMap.set(session.id, {
            ...session,
            isMine: false,
            // Ensure name is always available
            name: session.name || session.title || "Untitled Session",
          });
        }
      });

      // Convert map back to array
      const combined = Array.from(sessionsMap.values());
      setAllFilteredSessions(combined);
      setFilteredSessions(combined);
    }
  }, [userSessions, allSessions, userSessionsLoading, allSessionsLoading]);

  // When the component mounts, refresh the sessions list
  useEffect(() => {
    // Refresh sessions list when the component mounts
    handleRefresh();

    // Listen for session-ended events
    const handleSessionEnded = (event) => {
      const { sessionId } = event.detail;
      console.log(`Session ended event received for session: ${sessionId}`);

      // Update sessions in state immediately without a full refresh
      setAllFilteredSessions((prevSessions) =>
        prevSessions.map((session) =>
          session.id === sessionId
            ? { ...session, status: "ended", isActive: false }
            : session
        )
      );

      // Also update filtered sessions
      setFilteredSessions((prevSessions) =>
        prevSessions.map((session) =>
          session.id === sessionId
            ? { ...session, status: "ended", isActive: false }
            : session
        )
      );

      // Still refresh from server after a short delay to ensure we have latest data
      setTimeout(() => {
        handleRefresh();
      }, 2000);
    };

    // Add event listener
    window.addEventListener("session-ended", handleSessionEnded);

    // Clean up
    return () => {
      window.removeEventListener("session-ended", handleSessionEnded);
    };
  }, []);

  // Apply filters when any filter changes
  useEffect(() => {
    if (allFilteredSessions.length === 0) return;

    let filtered = [...allFilteredSessions];

    // Apply search query
    if (searchQuery) {
      filtered = filtered.filter(
        (session) =>
          session.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (session.description &&
            session.description
              .toLowerCase()
              .includes(searchQuery.toLowerCase()))
      );
    }

    // Apply status filter
    if (statusFilter !== "All Status") {
      const status = statusFilter.toLowerCase();
      filtered = filtered.filter((session) => session.status === status);
    }

    // Apply language filter
    if (languageFilter !== "All Languages") {
      const language = languageFilter.toLowerCase();
      filtered = filtered.filter(
        (session) => session.language.toLowerCase() === language.toLowerCase()
      );
    }

    // Apply time filter
    if (timeFilter !== "All Time") {
      const now = new Date();
      let timeThreshold = new Date();

      if (timeFilter === "Last Hour") {
        timeThreshold.setHours(now.getHours() - 1);
      } else if (timeFilter === "Today") {
        timeThreshold.setHours(0, 0, 0, 0);
      } else if (timeFilter === "This Week") {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
        timeThreshold = new Date(now.setDate(diff));
        timeThreshold.setHours(0, 0, 0, 0);
      }

      filtered = filtered.filter(
        (session) => new Date(session.createdAt) >= timeThreshold
      );
    }

    // Apply session type filter
    if (sessionTypeFilter !== "All Sessions") {
      if (sessionTypeFilter === "Public") {
        filtered = filtered.filter((session) => session.isPublic);
      } else if (sessionTypeFilter === "Private") {
        filtered = filtered.filter((session) => !session.isPublic);
      } else if (sessionTypeFilter === "My Sessions") {
        filtered = filtered.filter((session) => session.isMine);
      }
    }

    setFilteredSessions(filtered);
  }, [
    allFilteredSessions,
    searchQuery,
    statusFilter,
    languageFilter,
    timeFilter,
    sessionTypeFilter,
  ]);

  // Handle refresh button click
  const handleRefresh = () => {
    setIsLoading(true);

    // Refresh both user sessions and all sessions
    refreshSessions();
    refreshAllSessions();
  };

  // Handle joining a session
  const handleJoinSession = async (sessionId) => {
    if (!currentUser) {
      // Redirect to login if no user
      navigate("/login", { state: { redirectTo: `/session/${sessionId}` } });
      return;
    }

    try {
      await joinSession(sessionId);
      navigate(`/session/${sessionId}`);
    } catch (error) {
      console.error("Failed to join session:", error);
      // Could display an error message here
    }
  };

  // Handle creating a new session
  const handleCreateSession = async (sessionData) => {
    if (!currentUser) {
      // Redirect to login if no user
      navigate("/login", { state: { redirectTo: "/livesessions" } });
      return;
    }

    const { onSessionCreated, ...sessionDataToSubmit } = sessionData;

    try {
      // Ensure the name field is set from title for consistency
      const sessionDataWithName = {
        ...sessionDataToSubmit,
        name: sessionDataToSubmit.title,
        status: "active", // Explicitly set status to active for new sessions
      };

      const sessionId = await createSession(sessionDataWithName);

      // Get the session details including the code
      const apiBaseUrl =
        import.meta.env.MODE === "development"
          ? import.meta.env.VITE_API_URL || "http://localhost:3001"
          : import.meta.env.VITE_PRODUCTION_API_URL ||
            "https://codecolab-852p.onrender.com";

      const token = await currentUser.getIdToken();
      const response = await fetch(`${apiBaseUrl}/api/sessions/${sessionId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const sessionDetails = await response.json();
        if (
          sessionDetails.status === "success" &&
          sessionDetails.data.sessionCode
        ) {
          // Call the callback with the session code and ID
          if (onSessionCreated) {
            onSessionCreated(sessionDetails.data.sessionCode, sessionId);
            return; // Don't navigate yet - let the user see the code
          }
        }
      }

      // If we couldn't get the code or there's no callback, just navigate
      setShowCreateModal(false);
      navigate(`/session/${sessionId}`);
    } catch (error) {
      console.error("Failed to create session:", error);
      alert("Failed to create session. Please try again.");
    }
  };

  // Handle joining a private session
  const handleJoinPrivateSession = async (sessionCode) => {
    setShowJoinModal(false);

    if (!currentUser) {
      // Redirect to login if no user
      navigate("/login", { state: { redirectTo: `/session/${sessionCode}` } });
      return;
    }

    try {
      // First we need to resolve the session code to a session ID
      const sessionId = await resolveSessionCode(sessionCode);
      if (!sessionId) {
        // Show error if code is invalid
        alert("Invalid session code. Please check and try again.");
        return;
      }

      await joinSession(sessionId);
      navigate(`/session/${sessionId}`);
    } catch (error) {
      console.error("Failed to join private session:", error);
      alert(
        "Failed to join session. The code may be invalid or the session has ended."
      );
    }
  };

  // Function to resolve session code to session ID
  const resolveSessionCode = async (code) => {
    try {
      // Use the appropriate API URL based on environment
      const apiBaseUrl =
        import.meta.env.MODE === "development"
          ? import.meta.env.VITE_API_URL || "http://localhost:3001"
          : import.meta.env.VITE_PRODUCTION_API_URL ||
            "https://codecolab-852p.onrender.com";

      // Make the API call to resolve the code
      const response = await fetch(`${apiBaseUrl}/api/sessions/code/${code}`);

      if (!response.ok) {
        if (response.status === 404) {
          alert("Invalid session code. Please check and try again.");
        } else {
          alert("Error resolving session code. Please try again.");
        }
        return null;
      }

      const data = await response.json();
      return data.status === "success" ? data.data.sessionId : null;
    } catch (error) {
      console.error("Error resolving session code:", error);
      alert(
        "Connection error. Please check your internet connection and try again."
      );
      return null;
    }
  };

  return (
    <div className="live-sessions-container">
      <header className="sessions-headers">
        <h1>Live Sessions</h1>
        <div className="view-controls">
          <button
            className={`view-button ${viewMode === "grid" ? "active" : ""}`}
            onClick={() => setViewMode("grid")}
          >
            <FaTh /> Grid
          </button>
          <button
            className={`view-button ${viewMode === "list" ? "active" : ""}`}
            onClick={() => setViewMode("list")}
          >
            <FaList /> List
          </button>
          <button
            className="refresh-button"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <FaSync className={isLoading ? "rotating" : ""} /> Refresh
          </button>
        </div>
        <div className="action-buttons">
          <button
            className="join-private-button"
            onClick={() => setShowJoinModal(true)}
          >
            <FaUserPlus /> Join with Code
          </button>
          <button
            className="new-session-button"
            onClick={() => setShowCreateModal(true)}
          >
            <FaPlus /> New Session
          </button>
        </div>
      </header>

      <div className="sessions-filters">
        <div className="search-container">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-selects">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <select
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value)}
            className="filter-select"
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="filter-select"
          >
            {TIME_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <select
            value={sessionTypeFilter}
            onChange={(e) => setSessionTypeFilter(e.target.value)}
            className="filter-select"
          >
            {SESSION_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading sessions...</p>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="no-sessions">
          <p>No sessions found matching your filters.</p>
          <button
            className="clear-filters-button"
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("All Status");
              setLanguageFilter("All Languages");
              setTimeFilter("All Time");
              setSessionTypeFilter("All Sessions");
            }}
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <>
          <div className="sessions-info-bar">
            <div className="info-badge">
              <FaLock />{" "}
              <span>
                Private sessions can only be joined with a session code
              </span>
            </div>
          </div>
          <div
            className={`sessions-grid ${
              viewMode === "list" ? "list-view" : ""
            }`}
          >
            {filteredSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onJoin={handleJoinSession}
              />
            ))}
          </div>
        </>
      )}

      {/* Join Private Session Modal */}
      {showJoinModal && (
        <JoinPrivateSessionModal
          onClose={() => setShowJoinModal(false)}
          onJoin={handleJoinPrivateSession}
        />
      )}

      {/* Create Session Modal */}
      {showCreateModal && (
        <CreateSessionModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateSession}
        />
      )}
    </div>
  );
};

export default LiveSessions;
