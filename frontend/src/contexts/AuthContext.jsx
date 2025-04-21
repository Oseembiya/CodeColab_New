import { createContext, useContext, useState, useEffect } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import {
  auth,
  db,
  storage,
  googleProvider,
  githubProvider,
} from "../services/firebase";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Create new user with email/password
  const signup = async (email, password, displayName, photoFile, bio) => {
    try {
      setError("");

      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // If photo was provided, upload to storage
      let photoURL = null;
      if (photoFile) {
        // Create storage reference
        const storageRef = ref(storage, `profile_images/${user.uid}`);

        // Upload file
        const uploadTask = await uploadBytesResumable(storageRef, photoFile);

        // Get download URL
        photoURL = await getDownloadURL(storageRef);
      }

      // Update user profile in Auth
      await updateProfile(user, {
        displayName,
        photoURL,
      });

      // Create user document in Firestore
      await setDoc(doc(db, "users", user.uid), {
        displayName,
        email,
        photoURL,
        bio: bio || "",
        joinDate: serverTimestamp(),
        settings: {
          theme: "dark",
        },
      });

      // Create initial user metrics document
      await setDoc(doc(db, "userActivities", user.uid), {
        totalSessions: 0,
        linesOfCode: 0,
        hoursSpent: 0,
        sessionHistory: [],
      });

      return user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Sign in with email/password
  const login = async (email, password) => {
    try {
      setError("");

      // First check if this email exists but with a different sign-in method
      try {
        console.log("Checking sign-in methods for:", email);
        const methods = await fetchSignInMethodsForEmail(auth, email).catch(
          (e) => {
            console.log("Error fetching sign-in methods:", e);
            return [];
          }
        );

        console.log("Available sign-in methods:", methods);

        // If the user has accounts but NOT with password
        if (methods && methods.length > 0 && !methods.includes("password")) {
          const providerNames = {
            "google.com": "Google",
            "github.com": "GitHub",
            "facebook.com": "Facebook",
            "twitter.com": "Twitter",
          };

          const providers = methods
            .map((m) => providerNames[m] || m)
            .join(", ");
          setError(
            `This email is linked to ${providers}. Please use that sign-in method instead.`
          );
          return null;
        }
      } catch (methodErr) {
        console.log("Error in sign-in method check:", methodErr);
        // Continue with normal login attempt
      }

      // Proceed with regular login
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      return userCredential.user;
    } catch (err) {
      console.error("Login error:", err.code, err.message);

      if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password"
      ) {
        setError(
          "Invalid email or password. Please check your credentials and try again."
        );
      } else if (err.code === "auth/too-many-requests") {
        setError(
          "Access temporarily disabled due to many failed login attempts. Please try again later or reset your password."
        );
      } else {
        setError(err.message || "Failed to sign in. Please try again.");
      }

      throw err;
    }
  };

  // Sign in with Google
  const loginWithGoogle = async () => {
    try {
      setError("");
      console.log("Starting Google authentication");

      // Configure Google provider to request proper scopes if needed
      googleProvider.setCustomParameters({
        prompt: "select_account",
        // Add additional scopes if needed
        // access_type: 'offline' // for refresh token
      });

      const result = await signInWithPopup(auth, googleProvider);
      console.log("Google auth successful, checking user document");

      // Check if this is a new user
      const userDoc = await getDoc(doc(db, "users", result.user.uid));

      if (!userDoc.exists()) {
        console.log("Creating new user document for Google user");
        // Create user document in Firestore for new users
        await setDoc(doc(db, "users", result.user.uid), {
          displayName:
            result.user.displayName || result.user.email.split("@")[0],
          email: result.user.email,
          photoURL: result.user.photoURL,
          bio: "",
          joinDate: serverTimestamp(),
          settings: {
            theme: "dark",
          },
        });

        // Create initial user metrics document
        await setDoc(doc(db, "userActivities", result.user.uid), {
          totalSessions: 0,
          linesOfCode: 0,
          hoursSpent: 0,
          sessionHistory: [],
        });
      }

      console.log("Google authentication complete");
      return result.user;
    } catch (err) {
      console.error("Google auth error:", err.code, err.message);

      // Handle specific Google errors
      if (err.code === "auth/account-exists-with-different-credential") {
        setError(
          "An account already exists with the same email. Try signing in with a different method."
        );
      } else if (err.code === "auth/popup-closed-by-user") {
        setError("Sign-in was cancelled. Please try again.");
      } else if (err.code === "auth/cancelled-popup-request") {
        // This is normal when multiple popups are attempted, don't show error
        console.log("Popup request cancelled (normal when retrying)");
      } else if (err.code === "auth/popup-blocked") {
        setError(
          "Sign-in popup was blocked by your browser. Please enable popups for this site."
        );
      } else if (err.code === "auth/unauthorized-domain") {
        setError(
          "This domain is not authorized for OAuth operations. Check Firebase console settings."
        );
        console.error(
          "Domain not authorized. Add this domain to the Firebase console under Authentication > Settings > Authorized domains"
        );
      } else {
        setError(err.message || "Failed to sign in with Google");
      }

      throw err;
    }
  };

  // Sign in with GitHub
  const loginWithGithub = async () => {
    try {
      setError("");
      console.log("Starting GitHub authentication");

      // Configure GitHub provider to request proper scopes
      githubProvider.setCustomParameters({
        prompt: "select_account",
        // Request additional scopes if needed
        // scope: 'user:email'
      });

      const result = await signInWithPopup(auth, githubProvider);
      console.log("GitHub auth successful, checking user document");

      // Check if this is a new user
      const userDoc = await getDoc(doc(db, "users", result.user.uid));

      if (!userDoc.exists()) {
        console.log("Creating new user document for GitHub user");
        // Create user document in Firestore for new users
        await setDoc(doc(db, "users", result.user.uid), {
          displayName:
            result.user.displayName || result.user.email.split("@")[0],
          email: result.user.email,
          photoURL: result.user.photoURL,
          bio: "",
          joinDate: serverTimestamp(),
          settings: {
            theme: "dark",
          },
        });

        // Create initial user metrics document
        await setDoc(doc(db, "userActivities", result.user.uid), {
          totalSessions: 0,
          linesOfCode: 0,
          hoursSpent: 0,
          sessionHistory: [],
        });
      }

      console.log("GitHub authentication complete");
      return result.user;
    } catch (err) {
      console.error("GitHub auth error:", err.code, err.message);

      // Handle specific GitHub errors
      if (err.code === "auth/account-exists-with-different-credential") {
        setError(
          "An account already exists with the same email. Try signing in with a different method."
        );
      } else if (err.code === "auth/popup-closed-by-user") {
        setError("Sign-in was cancelled. Please try again.");
      } else if (err.code === "auth/cancelled-popup-request") {
        // This is normal when multiple popups are attempted, don't show error
        console.log("Popup request cancelled (normal when retrying)");
      } else if (err.code === "auth/popup-blocked") {
        setError(
          "Sign-in popup was blocked by your browser. Please enable popups for this site."
        );
      } else {
        setError(err.message || "Failed to sign in with GitHub");
      }

      throw err;
    }
  };

  // Sign out
  const logout = () => {
    return signOut(auth);
  };

  // Reset password
  const resetPassword = (email) => {
    return sendPasswordResetEmail(auth, email);
  };

  const value = {
    currentUser,
    signup,
    login,
    loginWithGoogle,
    loginWithGithub,
    logout,
    resetPassword,
    error,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
