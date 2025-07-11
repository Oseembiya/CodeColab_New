import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FaHome,
  FaCode,
  FaChalkboard,
  FaSignInAlt,
  FaSignOutAlt,
  FaBars,
  FaTimes,
  FaAngleLeft,
  FaAngleRight,
  FaUser,
  FaList,
} from "react-icons/fa";
import { useAuth } from "../../contexts/AuthContext";
import "../../styles/components/Sidebar.css";

const Sidebar = ({ onFoldChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFolded, setIsFolded] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const isDesktop = window.innerWidth >= 992;

  // Check if window width is desktop size on mount and resize
  useEffect(() => {
    const handleResize = () => {
      const desktop = window.innerWidth >= 992;
      if (desktop && !isDesktop) {
        setIsOpen(true);
      } else if (!desktop && isDesktop) {
        setIsOpen(false);
      }
    };

    // Set initial state
    if (isDesktop) {
      setIsOpen(true);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isDesktop]);

  // Notify parent component when fold state changes
  useEffect(() => {
    if (onFoldChange) {
      onFoldChange(isFolded);
    }
  }, [isFolded, onFoldChange]);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const toggleFold = () => {
    setIsFolded(!isFolded);
  };

  const closeSidebar = () => {
    if (!isDesktop) {
      setIsOpen(false);
    }
  };

  // Handle user logout
  const handleLogout = async () => {
    try {
      await logout();
      navigate("/auth");
    } catch (error) {
      console.error("Failed to logout:", error);
    }
  };

  // Determine if the route is active
  const isActive = (path) => {
    if (path === "/") {
      return location.pathname === "/" || location.pathname === "/dashboard";
    }

    // Special handling for whiteboard routes
    if (path === "/whiteboard") {
      return (
        location.pathname.startsWith("/whiteboard/") ||
        location.pathname === "/standalone-whiteboard"
      );
    }

    // Special handling for session routes
    if (path === "/session") {
      return (
        location.pathname.startsWith("/session/") ||
        location.pathname === "/standalone-editor"
      );
    }

    return location.pathname.startsWith(path);
  };

  return (
    <>
      <div className="sidebar-toggle" onClick={toggleSidebar}>
        {isOpen ? <FaTimes /> : <FaBars />}
      </div>

      <div
        className={`sidebar ${isOpen ? "open" : ""} ${
          isFolded ? "folded" : ""
        }`}
      >
        <div className="sidebar-header">
          <h3>{!isFolded && "CodeColab"}</h3>
          <button className="fold-toggle" onClick={toggleFold}>
            {isFolded ? <FaAngleRight /> : <FaAngleLeft />}
          </button>
        </div>

        <nav className="sidebar-nav">
          <ul>
            <li className={isActive("/") ? "active" : ""}>
              <Link to="/dashboard" onClick={closeSidebar} title="Dashboard">
                <FaHome /> {!isFolded && <span>Dashboard</span>}
              </Link>
            </li>
            <li className={isActive("/sessions") ? "active" : ""}>
              <Link to="/sessions" onClick={closeSidebar} title="Live Sessions">
                <FaList /> {!isFolded && <span>Live Sessions</span>}
              </Link>
            </li>
            <li className={isActive("/session") ? "active" : ""}>
              <Link
                to="/session/new"
                onClick={closeSidebar}
                title="Code Editor"
              >
                <FaCode /> {!isFolded && <span>Code Editor</span>}
              </Link>
            </li>
            <li className={isActive("/whiteboard") ? "active" : ""}>
              <Link
                to="/whiteboard/new"
                onClick={closeSidebar}
                title="Whiteboard"
              >
                <FaChalkboard /> {!isFolded && <span>Whiteboard</span>}
              </Link>
            </li>
          </ul>
        </nav>

        {currentUser && (
          <>
            <div className="sidebar-spacer"></div>
            <div className="sidebar-user">
              <Link to="/profile" className="user-profile-link">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt="Profile"
                    className="user-avatar"
                  />
                ) : (
                  <div className="user-avatar-placeholder">
                    <FaUser />
                  </div>
                )}
                {!isFolded && (
                  <div className="user-info">
                    <span className="user-name">
                      {currentUser.displayName || "User"}
                    </span>
                    <small className="user-email">{currentUser.email}</small>
                  </div>
                )}
              </Link>
              <button
                onClick={handleLogout}
                className="logout-button"
                title="Logout"
              >
                <FaSignOutAlt /> {!isFolded && <span>Logout</span>}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Overlay to close sidebar when clicking outside */}
      {isOpen && !isDesktop && (
        <div className="sidebar-overlay" onClick={closeSidebar}></div>
      )}
    </>
  );
};

export default Sidebar;
