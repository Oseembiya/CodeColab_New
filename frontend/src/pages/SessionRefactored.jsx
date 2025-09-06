import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSession } from "../contexts/SessionContext";
import { useSocket } from "../contexts/SocketContext";
import { useAuth } from "../contexts/AuthContext";
import { useUserMetrics } from "../contexts/UserMetricsContext";
import ParticipantsList from "../components/ParticipantsList";
import {
  SessionHeader,
  EditorToolbar,
  EditorTools,
  CodeEditor,
  OutputPanel,
  ChallengeModal,
  ChallengeDetailsModal,
  ConfirmCloseModal,
  SettingsPanel,
} from "../components/Session";
import "../styles/pages/Session.css";
import { toast } from "react-hot-toast";
import VideoChat, {
  isVideoChatActive,
  setVideoChatActive,
} from "../components/VideoChat";

// Main Session Component
const SessionRefactored = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const {
    currentSession,
    joinSession,
    leaveSession,
    updateSessionCode,
    getSessionCode,
    endSession,
    isSessionOwner,
  } = useSession();
  const { socket, connected, authenticate } = useSocket();
  const { incrementMetrics } = useUserMetrics();

  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const isUnmountingRef = useRef(false);
  const sessionInitializedRef = useRef(false);

  const [code, setCode] = useState("// Start coding here\n\n");
  const [language, setLanguage] = useState("javascript");
  const [theme, setTheme] = useState("vs-dark");
  const [output, setOutput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [showEditorTools, setShowEditorTools] = useState(false);
  const [outputHeight, setOutputHeight] = useState(200);
  const [isOutputMinimized, setIsOutputMinimized] = useState(false);
  const [isOutputMaximized, setIsOutputMaximized] = useState(false);
  const [participants, setParticipants] = useState([]);
  const outputDragRef = useRef(null);
  const startDragYRef = useRef(null);
  const startHeightRef = useRef(null);
  const [codeChangeTimeout, setCodeChangeTimeout] = useState(null);
  const [previousLineCount, setPreviousLineCount] = useState(0);

  // Challenge feature
  const [showChallengeDetailsModal, setShowChallengeDetailsModal] =
    useState(false);
  const [challenges, setAvailableChallenges] = useState([]);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [currentChallenge, setCurrentChallenge] = useState(null);
  const [challengeInput, setChallengeInput] = useState({
    title: "",
    description: "",
    difficulty: "Easy",
  });
  const [showConfirmCloseModal, setShowConfirmCloseModal] = useState(false);

  // Video chat feature
  const [showVideoChat, setShowVideoChat] = useState(false);

  // Check for active video chat on mount and when sessionId changes
  useEffect(() => {
    if (sessionId && sessionId !== "new") {
      // Check if video chat is active for this session
      setShowVideoChat(isVideoChatActive(sessionId));
    }
  }, [sessionId]);

  // Pre-defined coding challenges
  const predefinedChallenges = [
    {
      id: "1",
      title: "Reverse a String",
      description:
        "Write a function that reverses a string without using the built-in reverse() method.\n\nExample:\nInput: 'hello'\nOutput: 'olleh'",
      difficulty: "Easy",
      starterCode: "function reverseString(str) {\n  // Your code here\n  \n}",
    },
    {
      id: "2",
      title: "Find the Missing Number",
      description:
        "Given an array containing n distinct numbers taken from 0, 1, 2, ..., n, find the one that is missing from the array.\n\nExample:\nInput: [3,0,1]\nOutput: 2",
      difficulty: "Medium",
      starterCode:
        "function findMissingNumber(nums) {\n  // Your code here\n  \n}",
    },
    {
      id: "3",
      title: "Palindrome Check",
      description:
        "Write a function to check if a given string is a palindrome (reads the same forward and backward), ignoring case and non-alphanumeric characters.\n\nExample:\nInput: 'A man, a plan, a canal: Panama'\nOutput: true",
      difficulty: "Easy",
      starterCode: "function isPalindrome(str) {\n  // Your code here\n  \n}",
    },
    {
      id: "4",
      title: "Maximum Subarray Sum",
      description:
        "Find the contiguous subarray within an array of integers that has the largest sum.\n\nExample:\nInput: [-2,1,-3,4,-1,2,1,-5,4]\nOutput: 6 (subarray [4,-1,2,1])",
      difficulty: "Hard",
      starterCode: "function maxSubArray(nums) {\n  // Your code here\n  \n}",
    },
    {
      id: "5",
      title: "FizzBuzz",
      description:
        "Write a function that outputs an array from 1 to n where:\n- For multiples of 3, add 'Fizz' to the array\n- For multiples of 5, add 'Buzz' to the array\n- For multiples of both 3 and 5, add 'FizzBuzz'\n- Otherwise, add the number\n\nExample:\nInput: 15\nOutput: [1, 2, 'Fizz', 4, 'Buzz', 'Fizz', 7, 8, 'Fizz', 'Buzz', 11, 'Fizz', 13, 14, 'FizzBuzz']",
      difficulty: "Easy",
      starterCode: "function fizzBuzz(n) {\n  // Your code here\n  \n}",
    },
  ];

  // Initialize session
  useEffect(() => {
    // Skip if unmounting
    if (isUnmountingRef.current) return;

    const initSession = async () => {
      if (!sessionId) return;

      // If we've already initialized this specific session, don't do it again
      if (sessionInitializedRef.current && currentSession?.id === sessionId) {
        return;
      }

      // Mark as initialized for this session
      sessionInitializedRef.current = true;

      // Check if we already loaded code from localStorage challenge
      const alreadyLoadedCode =
        sessionStorage.getItem(`code_loaded_${sessionId}`) === "true";

      if (sessionId === "new") {
        // Standalone mode - NO session joining or creation
        // Only set default code if not already loaded from challenge
        if (!alreadyLoadedCode) {
          setCode("// Start coding here\n\n");
          setLanguage("javascript");
        }

        // Set participants to just the current user for UI purposes
        setParticipants([
          {
            id: currentUser?.uid || "local-user",
            name: currentUser?.displayName || "You",
            isActive: true,
            audioEnabled: true,
            videoEnabled: true,
          },
        ]);
      } else {
        // Collaborative mode
        try {
          const sessionData = await joinSession(sessionId);

          // Check for code in SessionContext first
          const existingCode = getSessionCode(sessionId);

          // Only set code from session if we don't have a challenge code loaded
          // and there's no existing code in the context
          if (sessionData && !alreadyLoadedCode && !existingCode.code) {
            console.log("Setting code from session data");
            setCode(sessionData.code || "// Start coding here\n\n");
            setLanguage(sessionData.language || "javascript");
          } else if (existingCode.code && !alreadyLoadedCode) {
            // Use code from context (preserved from previous switch)
            console.log("Setting code from session context");
            setCode(existingCode.code);
            setLanguage(existingCode.language || "javascript");
          } else if (sessionData) {
            // Still set language even when using challenge code
            setLanguage(sessionData.language || "javascript");
          }

          // Subscribe to code updates
          if (socket) {
            // Force at least the current user as participant
            if (currentUser && participants.length === 0) {
              setParticipants([
                {
                  id: currentUser.uid,
                  name: currentUser.displayName || "You",
                  isActive: true,
                  audioEnabled: true,
                  videoEnabled: true,
                },
              ]);
            }

            socket.emit("join-session", sessionId);

            // Only listen for code updates if we don't have a challenge active
            // or in special cases where we need to respect remote changes
            socket.on("code-update", (data) => {
              if (data.sessionId === sessionId) {
                // Only update the code if we're not in the middle of a challenge
                // or if the change is from a challenge-selected event
                const canUpdateCode =
                  !currentChallenge ||
                  (data.fromChallenge &&
                    data.challengeId === currentChallenge.id);

                if (canUpdateCode) {
                  setCode(data.content);
                  // Also update code in session context
                  updateSessionCode(sessionId, data.content, language);

                  // If this is challenge code, also save it to localStorage
                  if (data.fromChallenge && currentChallenge) {
                    localStorage.setItem(
                      `challenge_code_${sessionId}`,
                      data.content
                    );
                  }
                }
              }
            });

            // Authenticate for advanced features
            if (currentUser) {
              authenticate({
                sessionId,
                user: {
                  uid: currentUser.uid,
                  displayName: currentUser.displayName || "Anonymous",
                  email: currentUser.email,
                  photoURL: currentUser.photoURL,
                },
              });
            }

            // Listen for participant updates
            socket.on("users-update", (users) => {
              if (Array.isArray(users) && users.length > 0) {
                // Make sure current user is included
                const currentUserExists = users.some(
                  (u) => u.id === currentUser?.uid
                );

                // Create a more reliable participants list with proper media status
                const updatedUsers = currentUserExists
                  ? [...users]
                  : [
                      ...users,
                      {
                        id: currentUser.uid,
                        name: currentUser.displayName || "You",
                        isActive: true,
                        audioEnabled: true,
                        videoEnabled: true,
                      },
                    ];

                // Store this comprehensive list directly
                setParticipants(updatedUsers);
              } else {
                // Only add current user as fallback if we actually have one
                if (currentUser) {
                  const fallbackUser = {
                    id: currentUser.uid,
                    name: currentUser.displayName || "You",
                    isActive: true,
                    audioEnabled: true,
                    videoEnabled: true,
                  };
                  setParticipants([fallbackUser]);
                }
              }
            });

            // Explicitly request the current users list
            socket.emit("get-users", { sessionId });
          }
        } catch (error) {
          console.error("Failed to join session:", error);
          if (!isUnmountingRef.current) {
            navigate("/session/new"); // Redirect to standalone mode on error
          }
        }
      }
    };

    // Only reset initialized flag when sessionId actually changes
    if (sessionInitializedRef.current && sessionId !== currentSession?.id) {
      sessionInitializedRef.current = false;
    }

    isUnmountingRef.current = false;
    initSession();

    // Ensure participants list has at least the current user even if server doesn't send updates
    const participantsTimer = setTimeout(() => {
      if (
        participants.length === 0 &&
        currentUser &&
        !isUnmountingRef.current
      ) {
        setParticipants([
          {
            id: currentUser.uid,
            name: currentUser.displayName || "You",
            isActive: true,
            audioEnabled: true,
            videoEnabled: true,
          },
        ]);
      }
    }, 3000);

    // Cleanup when leaving the page
    return () => {
      isUnmountingRef.current = true;
      clearTimeout(participantsTimer);

      if (socket && connected && sessionId && sessionId !== "new") {
        // Don't leave the session when switching between session and whiteboard
        // This was causing participants to be lost when switching views
        // Only clean up socket listeners related to this component
        socket.off("code-update");
        socket.off("users-update");
      }

      // Don't call leaveSession when just switching views
      // Only call leaveSession if in collaborative mode and truly exiting
      // if (sessionId && sessionId !== "new" && currentSession) {
      //   leaveSession(false);
      // }
    };
  }, [
    sessionId,
    joinSession,
    leaveSession,
    socket,
    navigate,
    currentUser,
    authenticate,
    currentSession,
    participants,
    currentChallenge,
    connected,
    updateSessionCode,
    getSessionCode,
  ]);

  // Exit collaboration mode and switch to standalone mode
  const handleExitCollaboration = () => {
    const isOwner = isSessionOwner(sessionId);

    // Check if the user is the session owner
    if (isOwner && sessionId !== "new") {
      console.log("Owner is exiting session, marking as ended");

      // Try to end the session in the database even if the endpoint is missing
      // This at least updates the local state in SessionContext
      endSession(sessionId);

      // If socket is connected, emit session-ended event
      if (socket && connected) {
        console.log("Emitting session-ended event");
        socket.emit("session-ended", {
          sessionId,
          userId: currentUser?.uid,
        });

        // Also dispatch a DOM event for LiveSessions page to listen to
        window.dispatchEvent(
          new CustomEvent("session-ended", {
            detail: { sessionId },
          })
        );
      }
    }

    if (socket && connected) {
      // Notify server that user is intentionally leaving the session
      socket.emit("leave-session", {
        sessionId,
        userId: currentUser?.uid,
      });

      // Remove socket listeners
      socket.off("code-update");
      socket.off("users-update");
    }

    isUnmountingRef.current = true;
    // Pass false to keep challenges in localStorage when exiting collaboration
    leaveSession(false);
    navigate("/session/new");
  };

  // Handle editor mounting
  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;
  };

  // Handle code changes with metrics tracking
  const handleCodeChange = (value) => {
    setCode(value);

    // Count lines for metrics
    const currentLineCount = value.split("\n").length;

    // If there's an active challenge, update the saved code
    if (currentChallenge) {
      localStorage.setItem(`challenge_code_${sessionId}`, value);
    }

    // Store code in session context to persist between view switches
    if (sessionId && sessionId !== "new") {
      updateSessionCode(sessionId, value, language);
    }

    // Only send updates in collaborative mode
    if (socket && connected && sessionId !== "new") {
      socket.emit("code-change", {
        sessionId,
        content: value,
      });
    }

    // Track metrics: debounce to prevent excessive updates
    if (codeChangeTimeout) {
      clearTimeout(codeChangeTimeout);
    }

    setCodeChangeTimeout(
      setTimeout(() => {
        // If lines increased, update metrics
        if (currentLineCount > previousLineCount) {
          incrementMetrics({
            linesOfCode: currentLineCount - previousLineCount,
          });
        }
        setPreviousLineCount(currentLineCount);
      }, 5000)
    ); // 5 second debounce
  };

  // Handle language change
  const handleLanguageChange = (e) => {
    const newLanguage = e.target.value;
    setLanguage(newLanguage);

    // Update language in session context
    if (sessionId && sessionId !== "new") {
      updateSessionCode(sessionId, code, newLanguage);
    }

    // Only notify others in collaborative mode
    if (socket && connected && sessionId !== "new") {
      socket.emit("language-change", {
        sessionId,
        language: newLanguage,
        senderId: "user-123",
      });
    }
  };

  // Run code simulation
  const handleRunCode = async () => {
    setIsRunning(true);
    setOutput("Running code...");

    try {
      // Use the appropriate API URL based on environment
      const apiBaseUrl =
        import.meta.env.MODE === "development"
          ? import.meta.env.VITE_API_URL || "http://localhost:3001"
          : import.meta.env.VITE_PRODUCTION_API_URL ||
            "https://codecolab-852p.onrender.com";

      // In production, we need the full URL, in development relative works with proxy
      const apiUrl = `${apiBaseUrl}/api/code/execute`;

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          language,
          stdin: "", // Could add input field in UI
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API error:", response.status, errorText);
        setOutput(`Server Error (${response.status}):\n${errorText}`);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      if (result.status && result.status.id !== 3) {
        // Not Accepted
        setOutput(
          `Error: ${result.status.description}\n${result.stderr || ""}`
        );
      } else {
        setOutput(result.stdout || "Code executed successfully (no output)");
      }
    } catch (error) {
      console.error("Error running code:", error);
      setOutput(`Failed to execute code: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Handle save
  const handleSave = () => {
    // Simulate saving
    alert("Code saved successfully!");
  };

  // Handle fullscreen toggle
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Handle escape key to exit fullscreen
  useEffect(() => {
    const handleEscPress = (event) => {
      if (event.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleEscPress);

    return () => {
      window.removeEventListener("keydown", handleEscPress);
    };
  }, [isFullscreen]);

  // Focus editor when entering fullscreen
  useEffect(() => {
    if (isFullscreen && editorRef.current) {
      setTimeout(() => {
        editorRef.current.focus();
      }, 100);
    }
  }, [isFullscreen]);

  // Editor tools functions
  const handleFormatCode = () => {
    if (editorRef.current) {
      editorRef.current.getAction("editor.action.formatDocument").run();
    }
  };

  const handleUndo = () => {
    if (editorRef.current) {
      editorRef.current.trigger("keyboard", "undo", null);
    }
  };

  const handleRedo = () => {
    if (editorRef.current) {
      editorRef.current.trigger("keyboard", "redo", null);
    }
  };

  const handleCopy = () => {
    if (editorRef.current) {
      const selection = editorRef.current.getSelection();
      const selectedText = editorRef.current
        .getModel()
        .getValueInRange(selection);
      navigator.clipboard.writeText(selectedText);
    }
  };

  const handlePaste = async () => {
    try {
      await navigator.clipboard.readText();
      if (editorRef.current) {
        editorRef.current.trigger("keyboard", "paste", null);
      }
    } catch (err) {
      console.error("Failed to paste:", err);
    }
  };

  const handleFind = () => {
    if (editorRef.current) {
      editorRef.current.trigger("keyboard", "actions.find", null);
    }
  };

  const handleFontSizeChange = (delta) => {
    const newSize = Math.max(8, Math.min(30, fontSize + delta));
    setFontSize(newSize);
  };

  const handleToggleTheme = () => {
    setTheme(theme === "vs-dark" ? "vs" : "vs-dark");
  };

  const handleUploadCode = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setCode(e.target.result);
      };
      reader.readAsText(file);
    }
  };

  const handleDownloadCode = () => {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `codecolab-${sessionId.substring(0, 8)}.${getFileExtension(
      language
    )}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getFileExtension = (lang) => {
    const extensions = {
      javascript: "js",
      typescript: "ts",
      python: "py",
      java: "java",
      csharp: "cs",
    };
    return extensions[lang] || "txt";
  };

  const handleClearEditor = () => {
    if (window.confirm("Are you sure you want to clear the editor?")) {
      setCode("// Start coding here\n\n");
    }
  };

  // Handle output panel resize
  const handleOutputDragStart = (e) => {
    e.preventDefault();
    startDragYRef.current = e.clientY;
    startHeightRef.current = outputHeight;
    document.addEventListener("mousemove", handleOutputDrag);
    document.addEventListener("mouseup", handleOutputDragEnd);
    document.body.style.cursor = "ns-resize";
    document.body.classList.add("resizing");
  };

  const handleOutputDrag = (e) => {
    if (startDragYRef.current === null) return;

    requestAnimationFrame(() => {
      const deltaY = startDragYRef.current - e.clientY;
      const newHeight = Math.max(
        50,
        Math.min(600, startHeightRef.current + deltaY)
      );
      setOutputHeight(newHeight);
    });
  };

  const handleOutputDragEnd = () => {
    startDragYRef.current = null;
    document.removeEventListener("mousemove", handleOutputDrag);
    document.removeEventListener("mouseup", handleOutputDragEnd);
    document.body.style.cursor = "";
    document.body.classList.remove("resizing");
  };

  const toggleOutputMinimize = () => {
    if (isOutputMaximized) {
      setIsOutputMaximized(false);
    } else {
      setIsOutputMinimized(!isOutputMinimized);
    }
  };

  const toggleOutputMaximize = () => {
    if (isOutputMinimized) {
      setIsOutputMinimized(false);
    } else {
      setIsOutputMaximized(!isOutputMaximized);
    }
  };

  const copyOutputToClipboard = () => {
    navigator.clipboard.writeText(output);
  };

  const clearOutput = () => {
    setOutput("");
  };

  // Determine editor height based on output state
  const getEditorContainerClass = () => {
    if (isOutputMinimized) return "editor-container output-minimized";
    if (isOutputMaximized) return "editor-container output-maximized";
    return "editor-container";
  };

  // Load challenge from localStorage on mount - load FIRST, before other initialization
  useEffect(() => {
    if (sessionId) {
      // Check if we have a saved challenge for this session
      const savedChallenge = localStorage.getItem(`challenge_${sessionId}`);
      if (savedChallenge) {
        try {
          const parsedChallenge = JSON.parse(savedChallenge);
          setCurrentChallenge(parsedChallenge);

          // Also load the saved code if available
          const savedCode = localStorage.getItem(`challenge_code_${sessionId}`);
          if (savedCode) {
            console.log("Loading saved challenge code from localStorage");
            setCode(savedCode);
            // Set a flag to prevent other initialization from overwriting this code
            sessionStorage.setItem(`code_loaded_${sessionId}`, "true");
          } else if (parsedChallenge.starterCode) {
            // Fallback to starter code if no saved code exists
            console.log("Loading challenge starter code");
            setCode(parsedChallenge.starterCode);
            // Set a flag to prevent other initialization from overwriting this code
            sessionStorage.setItem(`code_loaded_${sessionId}`, "true");
          }

          // Load challenges list if empty
          if (challenges.length === 0) {
            setAvailableChallenges(predefinedChallenges);
          }
        } catch (error) {
          console.error("Error loading saved challenge:", error);
          localStorage.removeItem(`challenge_${sessionId}`);
          localStorage.removeItem(`challenge_code_${sessionId}`);
        }
      }
    }
  }, [sessionId, challenges.length]);

  // Challenge feature functions
  const handleChallengeButtonClick = () => {
    // Set challenges to predefined list if not already set
    if (challenges.length === 0) {
      setAvailableChallenges(predefinedChallenges);
    }
    setShowChallengeModal(true);
  };

  const handleChallengeInputChange = (e) => {
    const { name, value } = e.target;
    setChallengeInput({
      ...challengeInput,
      [name]: value,
    });
  };

  const handleSelectChallenge = () => {
    if (!currentChallenge) return;

    // Close modal
    setShowChallengeModal(false);

    // Insert the starter code into the editor if available
    if (currentChallenge.starterCode && editorRef.current) {
      // Insert the challenge code template
      setCode(currentChallenge.starterCode);

      // Save both challenge and code to localStorage with session ID
      localStorage.setItem(
        `challenge_${sessionId}`,
        JSON.stringify(currentChallenge)
      );
      localStorage.setItem(
        `challenge_code_${sessionId}`,
        currentChallenge.starterCode
      );

      // Set the session storage flag to prevent other init code from overwriting
      sessionStorage.setItem(`code_loaded_${sessionId}`, "true");

      // If in collaborative mode, share with others
      if (socket && connected && sessionId !== "new") {
        // Send code update with challenge metadata
        socket.emit("code-change", {
          sessionId,
          content: currentChallenge.starterCode,
          fromChallenge: true,
          challengeId: currentChallenge.id,
        });

        // Also notify others about the challenge
        socket.emit("challenge-selected", {
          sessionId,
          challenge: currentChallenge,
        });
      }
    }
  };

  const handleCloseChallenge = () => {
    setShowConfirmCloseModal(true);
  };

  const confirmCloseChallenge = () => {
    if (!socket || !currentChallenge) return;

    socket.emit("close-challenge", { sessionId, challenge: currentChallenge });
    localStorage.removeItem(`challenge_${sessionId}`);
    setCurrentChallenge(null);
    setShowConfirmCloseModal(false);
    setShowChallengeDetailsModal(false);

    // Add analytics event
    incrementMetrics({
      type: "challenge_closed",
      userId: currentUser?.uid,
      sessionId,
      data: {
        challengeId: currentChallenge.id,
        challengeTitle: currentChallenge.title,
      },
    });

    toast.success("Challenge closed successfully");
  };

  const cancelCloseChallenge = () => {
    setShowConfirmCloseModal(false);
  };

  // Listen for challenge events from other participants
  useEffect(() => {
    if (socket && sessionId !== "new") {
      // Listen for selected challenges
      socket.on("challenge-selected", (data) => {
        if (data.sessionId === sessionId) {
          setCurrentChallenge(data.challenge);

          // If there's starter code, update the editor
          if (data.challenge.starterCode) {
            setCode(data.challenge.starterCode);

            // Save both challenge and code to localStorage
            localStorage.setItem(
              `challenge_${sessionId}`,
              JSON.stringify(data.challenge)
            );
            localStorage.setItem(
              `challenge_code_${sessionId}`,
              data.challenge.starterCode
            );
          }
        }
      });

      // Listen for challenge closed
      socket.on("challenge-closed", (data) => {
        if (data.sessionId === sessionId) {
          setCurrentChallenge(null);
          localStorage.removeItem(`challenge_${sessionId}`);
          localStorage.removeItem(`challenge_code_${sessionId}`);
          sessionStorage.removeItem(`code_loaded_${sessionId}`);
        }
      });

      return () => {
        socket.off("challenge-selected");
        socket.off("challenge-closed");
      };
    }
  }, [socket, sessionId]);

  // Inside toggleVideoChat function
  const toggleVideoChat = () => {
    const newState = !showVideoChat;
    setShowVideoChat(newState);

    // Update localStorage
    if (newState) {
      setVideoChatActive(sessionId);

      // Start tracking time spent in video call for metrics when activating
      if (incrementMetrics) {
        incrementMetrics({
          type: "video_call_started",
          data: {
            sessionId,
            timestamp: new Date().toISOString(),
          },
        });
      }
    }
  };

  // Handle closing video chat
  const handleCloseVideoChat = () => {
    setShowVideoChat(false);

    // Track video call ended for metrics
    if (incrementMetrics) {
      incrementMetrics({
        type: "video_call_ended",
        data: {
          sessionId,
          timestamp: new Date().toISOString(),
        },
      });
    }
  };

  return (
    <div className="session-container">
      {/* Session Header */}
      <SessionHeader
        isFullscreen={isFullscreen}
        sessionId={sessionId}
        currentSession={currentSession}
        connected={connected}
        handleExitCollaboration={handleExitCollaboration}
        handleSave={handleSave}
        setShowSettings={setShowSettings}
        showSettings={showSettings}
      />

      {/* Main content area */}
      <div
        className={`session-content ${
          isFullscreen ? "fullscreen-content" : ""
        } ${sessionId === "new" ? "standalone-mode" : ""}`}
      >
        {/* Sidebar with participants - only show in collaborative mode */}
        {sessionId !== "new" && (
          <div className={`session-sidebar ${isFullscreen ? "hidden" : ""}`}>
            <ParticipantsList
              participants={participants}
              currentUserId={currentUser?.uid}
            />
          </div>
        )}

        {/* Editor area - adjust width when in standalone mode */}
        <div
          className={`editor-area ${isFullscreen ? "fullscreen-editor" : ""} ${
            sessionId === "new" ? "standalone-mode" : ""
          }`}
        >
          {/* Editor toolbar */}
          <EditorToolbar
            language={language}
            handleLanguageChange={handleLanguageChange}
            showEditorTools={showEditorTools}
            setShowEditorTools={setShowEditorTools}
            currentChallenge={currentChallenge}
            setShowChallengeDetailsModal={setShowChallengeDetailsModal}
            sessionId={sessionId}
            handleChallengeButtonClick={handleChallengeButtonClick}
            handleRunCode={handleRunCode}
            isRunning={isRunning}
            isFullscreen={isFullscreen}
            toggleFullscreen={toggleFullscreen}
            onToggleVideoChat={toggleVideoChat}
          />

          {/* Editor tools bar */}
          {showEditorTools && (
            <EditorTools
              handleFormatCode={handleFormatCode}
              handleUndo={handleUndo}
              handleRedo={handleRedo}
              handleCopy={handleCopy}
              handlePaste={handlePaste}
              handleFind={handleFind}
              handleFontSizeChange={handleFontSizeChange}
              fontSize={fontSize}
              handleToggleTheme={handleToggleTheme}
              theme={theme}
              handleUploadCode={handleUploadCode}
              fileInputRef={fileInputRef}
              handleFileChange={handleFileChange}
              handleDownloadCode={handleDownloadCode}
              handleClearEditor={handleClearEditor}
            />
          )}

          {/* Editor and output container */}
          <div className="editor-output-container">
            {/* Code editor */}
            <div className={getEditorContainerClass()}>
              <CodeEditor
                editorRef={editorRef}
                language={language}
                theme={theme}
                code={code}
                handleCodeChange={handleCodeChange}
                handleEditorDidMount={handleEditorDidMount}
                fontSize={fontSize}
              />
            </div>

            {/* Output panel */}
            {output && (
              <OutputPanel
                output={output}
                isOutputMinimized={isOutputMinimized}
                isOutputMaximized={isOutputMaximized}
                outputHeight={outputHeight}
                handleOutputDragStart={handleOutputDragStart}
                outputDragRef={outputDragRef}
                copyOutputToClipboard={copyOutputToClipboard}
                clearOutput={clearOutput}
                toggleOutputMinimize={toggleOutputMinimize}
                toggleOutputMaximize={toggleOutputMaximize}
                setOutput={setOutput}
              />
            )}
          </div>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <SettingsPanel
            setShowSettings={setShowSettings}
            theme={theme}
            setTheme={setTheme}
            fontSize={fontSize}
            setFontSize={setFontSize}
            handleFontSizeChange={handleFontSizeChange}
          />
        )}

        {/* Challenge modal */}
        {showChallengeModal && (
          <ChallengeModal
            setShowChallengeModal={setShowChallengeModal}
            handleSelectChallenge={handleSelectChallenge}
            currentChallenge={currentChallenge}
            challenges={challenges}
            setCurrentChallenge={setCurrentChallenge}
          />
        )}

        {/* Challenge details modal */}
        {showChallengeDetailsModal && currentChallenge && (
          <ChallengeDetailsModal
            currentChallenge={currentChallenge}
            setShowChallengeDetailsModal={setShowChallengeDetailsModal}
            handleCloseChallenge={handleCloseChallenge}
          />
        )}

        {/* Confirm Close Challenge Modal */}
        {showConfirmCloseModal && (
          <ConfirmCloseModal
            cancelCloseChallenge={cancelCloseChallenge}
            confirmCloseChallenge={confirmCloseChallenge}
          />
        )}

        {/* Video chat component */}
        {showVideoChat && sessionId !== "new" && (
          <div
            className={`video-chat-wrapper ${
              isFullscreen ? "fullscreen-minimized" : ""
            }`}
          >
            <VideoChat
              sessionId={sessionId}
              participants={participants}
              onClose={handleCloseVideoChat}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionRefactored;
