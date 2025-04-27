// Exit collaboration mode and switch to standalone mode
const handleExitCollaboration = () => {
  if (socket && connected) {
    // Notify server that user is intentionally leaving the session
    console.log(`Emitting leave-session for session ${sessionId}`);
    socket.emit("leave-session", {
      sessionId,
      userId: currentUser?.uid,
    });

    // Remove socket listeners
    socket.off("whiteboard-draw");
    socket.off("whiteboard-update");
    socket.off("whiteboard-clear");
    socket.off("users-update");
    socket.off("joined-session-room");
  }

  isUnmountingRef.current = true;
  // Call leaveSession but don't clear the challenge in localStorage
  leaveSession(false);
  navigate("/whiteboard/new");
};
