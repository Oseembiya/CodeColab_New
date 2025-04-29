import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { SessionProvider } from "./contexts/SessionContext";
import { SocketProvider } from "./contexts/SocketContext";
import { UserMetricsProvider } from "./contexts/UserMetricsContext";
import { useAuth } from "./contexts/AuthContext";
import { Toaster } from "react-hot-toast";
import Sidebar from "./components/layout/Sidebar";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/auth";
import Profile from "./pages/profile";
import Session from "./pages/session";
import Whiteboard from "./pages/whiteboard";
import StandaloneEditor from "./pages/standaloneEditor";
import StandaloneWhiteboard from "./pages/standaloneWhiteboard";
import LiveSessions from "./pages/liveSessions";
import "./styles/App.css";

// Protected route component
const ProtectedRoute = ({ children }) => {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return <Navigate to="/auth" replace />;
  }
  return children;
};

function App() {
  const [loading, setLoading] = useState(true);
  const [isSidebarFolded, setIsSidebarFolded] = useState(false);
  const { currentUser } = useAuth();

  useEffect(() => {
    // Remove loading state after a short delay
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Function to update sidebar folded state
  const handleSidebarFold = (folded) => {
    setIsSidebarFolded(folded);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading CodeColab...</p>
      </div>
    );
  }

  return (
    <div
      className={`app-container ${isSidebarFolded ? "sidebar-folded" : ""} ${
        !currentUser ? "auth-only" : ""
      }`}
    >
      {/* Toast notifications */}
      <Toaster position="top-right" />

      <SocketProvider>
        <UserMetricsProvider>
          <SessionProvider>
            {/* Only show sidebar for authenticated users */}
            {currentUser && <Sidebar onFoldChange={handleSidebarFold} />}

            <div className="main-content">
              <Routes>
                {/* Auth route - combines login and register */}
                <Route
                  path="/auth"
                  element={
                    currentUser ? (
                      <Navigate to="/dashboard" replace />
                    ) : (
                      <Auth />
                    )
                  }
                />

                {/* Root path redirect to dashboard */}
                <Route
                  path="/"
                  element={
                    currentUser ? (
                      <Navigate to="/dashboard" replace />
                    ) : (
                      <Navigate to="/auth" replace />
                    )
                  }
                />

                {/* Protected routes */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/sessions"
                  element={
                    <ProtectedRoute>
                      <LiveSessions />
                    </ProtectedRoute>
                  }
                />

                {/* Standalone Mode Routes */}
                <Route
                  path="/standalone-editor"
                  element={
                    <ProtectedRoute>
                      <StandaloneEditor />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/standalone-whiteboard"
                  element={
                    <ProtectedRoute>
                      <StandaloneWhiteboard />
                    </ProtectedRoute>
                  }
                />

                {/* Collaborative Mode Routes */}
                <Route
                  path="/session/:sessionId"
                  element={
                    <ProtectedRoute>
                      <Session />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/whiteboard/:sessionId"
                  element={
                    <ProtectedRoute>
                      <Whiteboard />
                    </ProtectedRoute>
                  }
                />

                {/* Redirect legacy routes */}
                <Route
                  path="/login"
                  element={<Navigate to="/auth" replace />}
                />
                <Route
                  path="/register"
                  element={<Navigate to="/auth" replace />}
                />

                {/* Legacy standalone mode redirects */}
                <Route
                  path="/session/new"
                  element={<Navigate to="/standalone-editor" replace />}
                />
                <Route
                  path="/whiteboard/new"
                  element={<Navigate to="/standalone-whiteboard" replace />}
                />

                {/* Catch all unknown routes and redirect */}
                <Route
                  path="*"
                  element={
                    currentUser ? (
                      <Navigate to="/dashboard" replace />
                    ) : (
                      <Navigate to="/auth" replace />
                    )
                  }
                />
              </Routes>
            </div>
          </SessionProvider>
        </UserMetricsProvider>
      </SocketProvider>
    </div>
  );
}

export default App;
