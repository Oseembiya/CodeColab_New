import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { SessionProvider } from "./contexts/SessionContext";
import { SocketProvider } from "./contexts/SocketContext";
import { UserMetricsProvider } from "./contexts/UserMetricsContext";
import { useAuth } from "./contexts/AuthContext";
import { Toaster } from "react-hot-toast";
import Sidebar from "./components/layout/Sidebar";
import Dashboard from "./pages/dashboard";
import Auth from "./pages/auth";
import Profile from "./pages/profile";
import Session from "./pages/session";
import Whiteboard from "./pages/whiteboard";
import StandaloneEditor from "./pages/standaloneEditor";
import StandaloneWhiteboard from "./pages/standaloneWhiteboard";
import LiveSessions from "./pages/liveSessions";

// Protected route component
const ProtectedRoute = ({ children }) => {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return <Navigate to="/auth" replace />;
  }
  return children;
};

// Define protected routes configuration
const protectedRoutes = [
  { path: "/dashboard", element: <Dashboard /> },
  { path: "/profile", element: <Profile /> },
  { path: "/sessions", element: <LiveSessions /> },
  { path: "/standalone-editor", element: <StandaloneEditor /> },
  { path: "/standalone-whiteboard", element: <StandaloneWhiteboard /> },
  { path: "/session/:sessionId", element: <Session /> },
  { path: "/whiteboard/:sessionId", element: <Whiteboard /> },
];

// Define legacy redirects
const legacyRedirects = [
  { from: "/session/new", to: "/standalone-editor" },
  { from: "/whiteboard/new", to: "/standalone-whiteboard" },
];

function App() {
  const [loading, setLoading] = useState(true);
  const [isSidebarFolded, setIsSidebarFolded] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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

  // Function to update sidebar open state
  const handleSidebarOpen = (open) => {
    setIsSidebarOpen(open);
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
        !isSidebarOpen ? "sidebar-closed" : ""
      } ${!currentUser ? "auth-only" : ""}`}
    >
      {/* Toast notifications */}
      <Toaster position="top-right" />

      <SocketProvider>
        <UserMetricsProvider>
          <SessionProvider>
            {/* Only show sidebar for authenticated users */}
            {currentUser && (
              <Sidebar
                onFoldChange={handleSidebarFold}
                onOpenChange={handleSidebarOpen}
              />
            )}

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
                {protectedRoutes.map(({ path, element }) => (
                  <Route
                    key={path}
                    path={path}
                    element={<ProtectedRoute>{element}</ProtectedRoute>}
                  />
                ))}

                {/* Legacy redirects */}
                {legacyRedirects.map(({ from, to }) => (
                  <Route
                    key={from}
                    path={from}
                    element={<Navigate to={to} replace />}
                  />
                ))}
              </Routes>
            </div>
          </SessionProvider>
        </UserMetricsProvider>
      </SocketProvider>
    </div>
  );
}

export default App;
