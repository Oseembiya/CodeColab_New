import { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { useSocket } from "./SocketContext";
import axios from "axios";

const UserMetricsContext = createContext();

export const useUserMetrics = () => {
  const context = useContext(UserMetricsContext);
  if (!context) {
    throw new Error("useUserMetrics must be used within a UserMetricsProvider");
  }
  return context;
};

export const UserMetricsProvider = ({ children }) => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();
  const { socket } = useSocket();

  // Base URL for API calls
  const baseUrl =
    import.meta.env.MODE === "development"
      ? import.meta.env.VITE_API_URL || "http://localhost:3001"
      : import.meta.env.VITE_PRODUCTION_API_URL || "";

  // Fetch user metrics from Firebase
  useEffect(() => {
    const fetchUserMetrics = async () => {
      if (!currentUser) {
        // If no user is logged in, reset metrics and stop loading
        setMetrics(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const token = await currentUser.getIdToken();
        const apiUrl = `${baseUrl}/api/metrics`.replace(/\/\/api/, "/api");

        const response = await axios.get(apiUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.data.status === "success") {
          setMetrics(response.data.data);
        }
      } catch (error) {
        console.error("Error fetching user metrics:", error);
        // Set default metrics if fetch fails
        setMetrics({
          totalSessions: 0,
          hoursSpent: 0,
          linesOfCode: 0,
          collaborations: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUserMetrics();
  }, [currentUser, baseUrl]);

  // Listen for collaboration events from the socket
  useEffect(() => {
    if (!socket || !currentUser) return;

    // Handle collaboration joined event - update owner's metrics
    const handleCollaborationJoined = (data) => {
      console.log("Received collaboration-joined event:", data);

      // Only update metrics if this user is the owner of the session
      if (data.ownerId === currentUser.uid) {
        console.log("Updating collaboration metrics for session owner");
        incrementMetrics({ collaborations: 1 });
      }
    };

    // Register event listener
    socket.on("collaboration-joined", handleCollaborationJoined);

    // Cleanup event listener
    return () => {
      socket.off("collaboration-joined", handleCollaborationJoined);
    };
  }, [socket, currentUser]);

  // Update metrics in Firebase
  const updateMetrics = async (newMetrics) => {
    if (!currentUser) return;

    console.log("Updating metrics:", newMetrics);

    try {
      const token = await currentUser.getIdToken();
      const apiUrl = `${baseUrl}/api/metrics`.replace(/\/\/api/, "/api");

      const response = await axios.put(
        apiUrl,
        { metricsUpdate: newMetrics },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.status === "success") {
        console.log("Metrics updated successfully:", response.data.data);
        setMetrics(response.data.data);
      }
    } catch (error) {
      console.error("Error updating metrics:", error);
    }
  };

  // Increment specific metrics (for counters)
  const incrementMetrics = async (increments) => {
    if (!currentUser) return;

    try {
      const token = await currentUser.getIdToken();
      const apiUrl = `${baseUrl}/api/metrics/increment`.replace(
        /\/\/api/,
        "/api"
      );

      const response = await axios.post(
        apiUrl,
        { increments },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.status === "success") {
        setMetrics(response.data.data);
      }
    } catch (error) {
      console.error("Error incrementing metrics:", error);
    }
  };

  const value = {
    metrics,
    loading,
    updateMetrics,
    incrementMetrics,
  };

  return (
    <UserMetricsContext.Provider value={value}>
      {children}
    </UserMetricsContext.Provider>
  );
};

export default UserMetricsContext;
