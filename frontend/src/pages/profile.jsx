import { useState, useEffect } from "react";
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
} from "react-icons/fa";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { updateProfile } from "firebase/auth";
import { useAuth } from "../contexts/AuthContext";
import { db, storage } from "../services/firebase";
import "../styles/pages/Profile.css";

const Profile = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { currentUser } = useAuth();

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

  // Form state for editing
  const [formData, setFormData] = useState({
    name: "",
    bio: "",
    profileImage: "",
    newProfileImage: null,
  });

  // Fetch user profile on load
  useEffect(() => {
    if (currentUser) {
      fetchUserProfile();
    }
  }, [currentUser]);

  // Fetch real user data from Firestore
  const fetchUserProfile = async () => {
    setIsLoading(true);

    try {
      // Get the user document from Firestore
      const userDocRef = doc(db, "users", currentUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        setError("User profile not found");
        setIsLoading(false);
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

      setFormData({
        name: userData.displayName || currentUser.displayName || "User",
        bio: userData.bio || "",
        profileImage: userData.photoURL || currentUser.photoURL || "",
        newProfileImage: null,
      });
    } catch (err) {
      console.error("Error fetching user profile:", err);
      setError("Failed to load profile data");
    }

    setIsLoading(false);
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

  // Start editing profile
  const startEditing = () => {
    setIsEditing(true);
    setError("");
    setSuccess("");
  };

  // Cancel editing and reset form
  const cancelEditing = () => {
    setFormData({
      name: profile.name,
      bio: profile.bio,
      profileImage: profile.profileImage,
      newProfileImage: null,
    });
    setIsEditing(false);
    setError("");
  };

  // Save profile changes
  const saveProfile = async () => {
    setError("");
    setSuccess("");

    if (!formData.name.trim()) {
      setError("Name cannot be empty");
      return;
    }

    setIsLoading(true);

    try {
      // Reference to the user document
      const userDocRef = doc(db, "users", currentUser.uid);

      // If there's a new profile image, upload it
      let photoURL = profile.profileImage;

      if (formData.newProfileImage) {
        const storageRef = ref(storage, `profile_images/${currentUser.uid}`);
        await uploadBytesResumable(storageRef, formData.newProfileImage);
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

      // Update the user document in Firestore
      await updateDoc(userDocRef, {
        displayName: formData.name,
        bio: formData.bio,
        photoURL,
      });

      // Update local profile state
      setProfile((prev) => ({
        ...prev,
        name: formData.name,
        bio: formData.bio,
        profileImage: photoURL,
      }));

      setIsEditing(false);
      setSuccess("Profile updated successfully!");

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Error updating profile:", err);
      setError("Failed to update profile");
    }

    setIsLoading(false);
  };

  if (isLoading && !profile.name) {
    return (
      <div className="profile-loading">
        <div className="loading-spinner"></div>
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h1>User Profile</h1>
        {!isEditing ? (
          <button className="edit-button" onClick={startEditing}>
            <FaUserEdit /> Edit Profile
          </button>
        ) : (
          <div className="edit-actions">
            <button
              className="save-button"
              onClick={saveProfile}
              disabled={isLoading}
            >
              <FaSave /> {isLoading ? "Saving..." : "Save Changes"}
            </button>
            <button className="cancel-button" onClick={cancelEditing}>
              <FaTimes /> Cancel
            </button>
          </div>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="profile-content">
        <div className="profile-sidebar">
          <div className="profile-image-container">
            {isEditing ? (
              <>
                <div className="profile-image edit-mode">
                  <img src={formData.profileImage} alt="Profile" />
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
                    accept="image/*"
                  />
                </div>
              </>
            ) : (
              <div className="profile-image">
                <img src={profile.profileImage} alt="Profile" />
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
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                rows="5"
                placeholder="Tell us about yourself"
              />
            ) : (
              <p>{profile.bio}</p>
            )}
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
              <p className="empty-list">No projects yet</p>
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
              <p className="empty-list">No recent sessions</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
