import { useState, useEffect, useRef } from "react";
import {
  FaUser,
  FaEnvelope,
  FaPencilAlt,
  FaSave,
  FaTimes,
  FaCamera,
  FaUserEdit,
  FaPlus,
  FaUsers,
  FaCode,
  FaClock,
  FaUserFriends,
  FaExclamationTriangle,
} from "react-icons/fa";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { updateProfile } from "firebase/auth";
import { useAuth } from "../contexts/AuthContext";
import { db, storage } from "../services/firebase";
import { toast } from "react-hot-toast";
import axios from "axios";
import "../styles/pages/Profile.css";

const Profile = () => {
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const { currentUser } = useAuth();
  const fileInputRef = useRef(null);

  // User profile state
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    bio: "",
    profileImage: "",
    joinDate: "",
    projects: [],
    sessions: [],
  });

  // User metrics state
  const [metrics, setMetrics] = useState({
    totalSessions: 0,
    hoursSpent: 0,
    linesOfCode: 0,
    collaborations: 0,
  });

  // Form state for editing
  const [formData, setFormData] = useState({
    name: "",
    bio: "",
    profileImage: "",
    newProfileImage: null,
  });

  // Original form data for checking changes
  const [originalFormData, setOriginalFormData] = useState({
    name: "",
    bio: "",
    profileImage: "",
  });

  // Initialize profile with currentUser data immediately (for faster display)
  useEffect(() => {
    if (currentUser) {
      // Format join date from user metadata if available
      let initialJoinDate = "N/A";
      if (currentUser.metadata && currentUser.metadata.creationTime) {
        try {
          initialJoinDate = new Date(currentUser.metadata.creationTime).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });
        } catch (e) {
          // If date parsing fails, keep "N/A"
        }
      }
      
      // Set initial profile data from currentUser immediately for instant display
      setProfile((prev) => ({
        ...prev,
        name: currentUser.displayName || "User",
        email: currentUser.email || "",
        profileImage: currentUser.photoURL || "",
        bio: "", // Will be updated from Firestore if available
        joinDate: initialJoinDate, // Will be updated from Firestore if available
      }));
      
      // Preload the profile image
      if (currentUser.photoURL) {
        const img = new Image();
        img.src = currentUser.photoURL;
      }
      
      fetchUserProfile();
      fetchUserMetrics();
    }
  }, [currentUser]);

  // Check for unsaved changes
  useEffect(() => {
    if (isEditing) {
      const hasUnsavedChanges =
        formData.name !== originalFormData.name ||
        formData.bio !== originalFormData.bio ||
        formData.newProfileImage !== null;

      setHasChanges(hasUnsavedChanges);
    }
  }, [formData, originalFormData, isEditing]);

  // Fetch user metrics from API
  const fetchUserMetrics = async () => {
    try {
      // Get auth token
      const token = await currentUser.getIdToken();

      const response = await axios.get("http://localhost:3001/api/metrics", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.status === "success") {
        setMetrics(response.data.data);
      }
    } catch (err) {
      console.error("Error fetching user metrics:", err);
      // Don't show error for metrics - non-critical
    }
  };

  // Fetch real user data from Firestore
  const fetchUserProfile = async () => {
    try {
      // Get the user document from Firestore
      const userDocRef = doc(db, "users", currentUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        toast.error("User profile not found");
        return;
      }

      const userData = userDoc.data();

      // Get user activity data
      const activityDocRef = doc(db, "userActivities", currentUser.uid);
      const activityDoc = await getDoc(activityDocRef);
      const activityData = activityDoc.exists() ? activityDoc.data() : {};

      // Format join date
      const joinDate = userData.joinDate
        ? new Date(userData.joinDate.toDate()).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "N/A";

      // Create session data from activity history if available
      const sessions = activityData.sessionHistory || [];

      setProfile({
        name: userData.displayName || currentUser.displayName || "User",
        email: userData.email || currentUser.email,
        bio: userData.bio || "",
        profileImage: userData.photoURL || currentUser.photoURL || "",
        joinDate,
        projects: [], // Would fetch from projects collection in a real app
        sessions: sessions
          .map((session, index) => ({
            id: session.sessionId || index,
            name: session.title || `Session #${index + 1}`,
            date: new Date(session.timestamp).toLocaleDateString(),
          }))
          .slice(0, 5),
      });

      const formValues = {
        name: userData.displayName || currentUser.displayName || "User",
        bio: userData.bio || "",
        profileImage: userData.photoURL || currentUser.photoURL || "",
        newProfileImage: null,
      };

      setFormData(formValues);
      setOriginalFormData({
        name: formValues.name,
        bio: formValues.bio,
        profileImage: formValues.profileImage,
      });
    } catch (err) {
      console.error("Error fetching user profile:", err);
      toast.error("Failed to load profile data");
    }
  };

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle profile image change
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const validImageTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
      ];
      if (!validImageTypes.includes(file.type)) {
        toast.error("Please select a valid image file (JPEG, PNG, GIF, WEBP)");
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image is too large. Maximum size is 5MB");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({
          ...prev,
          profileImage: reader.result,
          newProfileImage: file,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle clicking on profile image to trigger file input
  const handleImageClick = () => {
    if (isEditing && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Start editing profile
  const startEditing = () => {
    setIsEditing(true);
    setHasChanges(false);
    setShowUnsavedWarning(false);
  };

  // Cancel editing and reset form
  const cancelEditing = () => {
    if (hasChanges) {
      setShowUnsavedWarning(true);
      return;
    }

    resetForm();
  };

  // Reset form without asking
  const resetForm = () => {
    setFormData({
      name: profile.name,
      bio: profile.bio,
      profileImage: profile.profileImage,
      newProfileImage: null,
    });
    setIsEditing(false);
    setShowUnsavedWarning(false);
  };

  // Handle form validation
  const validateForm = () => {
    // Reset previous errors
    toast.error("");

    // Validate name (required)
    if (!formData.name.trim()) {
      toast.error("Name cannot be empty");
      return false;
    }

    // Validate name length
    if (formData.name.trim().length > 15) {
      toast.error("Name must be less than 16 characters");
      return false;
    }

    return true;
  };

  // Save profile changes
  const saveProfile = async () => {
    toast.error("");

    // Validate form
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);

    const savingToast = toast.loading("Saving profile changes...");

    try {
      // Reference to the user document
      const userDocRef = doc(db, "users", currentUser.uid);

      // If there's a new profile image, upload it
      let photoURL = profile.profileImage;

      if (formData.newProfileImage) {
        const storageRef = ref(storage, `profile_images/${currentUser.uid}`);
        const uploadTask = uploadBytesResumable(
          storageRef,
          formData.newProfileImage
        );

        // Monitor upload progress
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress =
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            toast.loading(`Uploading image: ${Math.round(progress)}%`, {
              id: savingToast,
            });
          },
          (error) => {
            toast.error("Failed to upload profile image", { id: savingToast });
            throw error;
          }
        );

        // Wait for upload to complete
        await uploadTask;
        photoURL = await getDownloadURL(storageRef);

        // Update the auth profile
        await updateProfile(currentUser, {
          displayName: formData.name,
          photoURL,
        });
      } else if (formData.name !== currentUser.displayName) {
        // Just update the display name if it changed
        await updateProfile(currentUser, {
          displayName: formData.name,
        });
      }

      // Update API with backend call
      try {
        const token = await currentUser.getIdToken();
        await axios.post(
          "http://localhost:3001/api/users/profile",
          {
            displayName: formData.name,
            photoURL,
            bio: formData.bio,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      } catch (apiError) {
        console.error(
          "API update failed, falling back to direct Firebase update",
          apiError
        );
      }

      // Update the user document in Firestore
      await updateDoc(userDocRef, {
        displayName: formData.name,
        bio: formData.bio,
        photoURL,
        updatedAt: new Date(),
      });

      // Update local profile state
      setProfile((prev) => ({
        ...prev,
        name: formData.name,
        bio: formData.bio,
        profileImage: photoURL,
      }));

      // Update original form data
      setOriginalFormData({
        name: formData.name,
        bio: formData.bio,
        profileImage: photoURL,
      });

      setIsEditing(false);
      setHasChanges(false);
      toast.success("Profile updated successfully!", { id: savingToast });
    } catch (err) {
      console.error("Error updating profile:", err);
      toast.error("Failed to update profile", { id: savingToast });
    }

    setIsSaving(false);
  };

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h1>User Profile</h1>
        {!isEditing ? (
          <button
            className="edit-button"
            onClick={startEditing}
            aria-label="Edit profile"
          >
            <FaUserEdit /> Edit Profile
          </button>
        ) : (
          <div className="edit-actions">
            <button
              className="save-button"
              onClick={saveProfile}
              disabled={isSaving || !hasChanges}
              aria-label="Save profile changes"
            >
              <FaSave /> {isSaving ? "Saving..." : "Save Changes"}
            </button>
            <button
              className="cancel-button"
              onClick={cancelEditing}
              aria-label="Cancel editing"
            >
              <FaTimes /> Cancel
            </button>
          </div>
        )}
      </div>
      {/* Unsaved changes warning */}
      {showUnsavedWarning && (
        <div className="unsaved-warning">
          <FaExclamationTriangle />
          <p>
            You have unsaved changes. Are you sure you want to discard them?
          </p>
          <div className="warning-actions">
            <button onClick={resetForm} className="discard-button">
              Discard Changes
            </button>
            <button
              onClick={() => setShowUnsavedWarning(false)}
              className="continue-button"
            >
              Continue Editing
            </button>
          </div>
        </div>
      )}

      <div className="profile-content">
        <div className="profile-sidebar">
          <div className="profile-image-container">
            {isEditing ? (
              <>
                <div
                  className="profile-image edit-mode"
                  onClick={handleImageClick}
                  tabIndex={0}
                  role="button"
                  aria-label="Click to change profile image"
                  onKeyDown={(e) => e.key === "Enter" && handleImageClick()}
                >
                  <img
                    src={formData.profileImage || "/default-avatar.png"}
                    alt="Profile"
                    loading="eager"
                  />
                  <label
                    htmlFor="profile-image-upload"
                    className="image-upload-label"
                  >
                    <FaCamera />
                  </label>
                  <input
                    type="file"
                    id="profile-image-upload"
                    className="image-upload-input"
                    onChange={handleImageChange}
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    ref={fileInputRef}
                  />
                </div>
                <div className="image-upload-hint">Click image to change</div>
              </>
            ) : (
              <div className="profile-image">
                <img
                  src={profile.profileImage || "/default-avatar.png"}
                  alt="Profile"
                  loading="eager"
                />
              </div>
            )}

            <div className="profile-info">
              {isEditing ? (
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="name-edit-input"
                  maxLength={50}
                  aria-label="Display name"
                  placeholder="Your name"
                  required
                />
              ) : (
                <h2>{profile.name}</h2>
              )}

              <div className="profile-email">
                <FaEnvelope /> {profile.email}
              </div>

              <div className="profile-joined">
                <FaUser /> Joined {profile.joinDate}
              </div>
            </div>
          </div>

          <div className="profile-bio">
            <h3>Bio</h3>
            {isEditing ? (
              <>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  rows="5"
                  placeholder="Tell us about yourself"
                  maxLength={50}
                  aria-label="User bio"
                />
                <div className="bio-char-count">
                  {formData.bio.length}/50 characters
                </div>
              </>
            ) : (
              <p>{profile.bio || "No bio provided yet."}</p>
            )}
          </div>

          {/* User metrics section */}
          <div className="profile-metrics">
            <h3>Your Activity</h3>
            <div className="metrics-grid">
              <div className="metric-item">
                <FaCode className="metric-icon" />
                <div className="metric-value">{metrics.linesOfCode || 0}</div>
                <div className="metric-label">Lines of Code</div>
              </div>
              <div className="metric-item">
                <FaClock className="metric-icon" />
                <div className="metric-value">{metrics.hoursSpent || 0}</div>
                <div className="metric-label">Hours Spent</div>
              </div>
              <div className="metric-item">
                <FaUsers className="metric-icon" />
                <div className="metric-value">{metrics.totalSessions || 0}</div>
                <div className="metric-label">Sessions</div>
              </div>
              <div className="metric-item">
                <FaUserFriends className="metric-icon" />
                <div className="metric-value">
                  {metrics.collaborations || 0}
                </div>
                <div className="metric-label">Collaborations</div>
              </div>
            </div>
          </div>
        </div>

        <div className="profile-details">
          <div className="profile-section">
            <h3>Recent Projects</h3>
            {profile.projects && profile.projects.length > 0 ? (
              <ul className="profile-list">
                {profile.projects.map((project) => (
                  <li key={project.id} className="profile-list-item">
                    <div className="item-name">{project.name}</div>
                    <div className="item-meta">
                      Last edited: {project.lastEdited}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-list">
                <p>No projects yet</p>
                <button className="create-new-button">
                  <FaPlus /> Create New Project
                </button>
              </div>
            )}
          </div>

          <div className="profile-section">
            <h3>Recent Sessions</h3>
            {profile.sessions && profile.sessions.length > 0 ? (
              <ul className="profile-list">
                {profile.sessions.map((session) => (
                  <li key={session.id} className="profile-list-item">
                    <div className="item-name">{session.name}</div>
                    <div className="item-meta">{session.date}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-list">
                <p>No recent sessions</p>
                <button className="create-new-button">
                  <FaPlus /> Start New Session
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
