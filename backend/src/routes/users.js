const express = require("express");
const router = express.Router();
const { db, auth } = require("../config/firebase");
// const { authenticateUser } = require("../middleware/auth");

// Collection reference
const usersCollection = db.collection("users");

// Get current user profile
router.get("/me", async (req, res) => {
  try {
    const userDoc = await usersCollection.doc(req.user.uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        status: "error",
        message: "User profile not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: {
        id: userDoc.id,
        ...userDoc.data(),
      },
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch user profile",
    });
  }
});

// Create or update user profile
router.post("/profile", async (req, res) => {
  try {
    const { displayName, photoURL } = req.body;
    const userRef = usersCollection.doc(req.user.uid);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      // Update existing profile
      await userRef.update({
        displayName: displayName || userDoc.data().displayName,
        photoURL: photoURL || userDoc.data().photoURL,
        updatedAt: new Date(),
      });
    } else {
      // Create new profile
      await userRef.set({
        uid: req.user.uid,
        email: req.user.email,
        displayName: displayName || req.user.name,
        photoURL: photoURL || "",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    res.status(200).json({
      status: "success",
      message: "User profile updated successfully",
    });
  } catch (error) {
    console.error("Error updating user profile:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to update user profile",
    });
  }
});

// Get user by ID (for collaborators)
router.get("/:id", async (req, res) => {
  try {
    const userDoc = await usersCollection.doc(req.params.id).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    // Return only public information
    const userData = userDoc.data();
    const publicUserData = {
      uid: userData.uid,
      displayName: userData.displayName,
      photoURL: userData.photoURL,
    };

    res.status(200).json({
      status: "success",
      data: publicUserData,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch user",
    });
  }
});

// Search users by email (for adding collaborators)
router.get("/search/email", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        status: "error",
        message: "Email query parameter is required",
      });
    }

    const usersSnapshot = await usersCollection
      .where("email", "==", email)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      return res.status(404).json({
        status: "error",
        message: "No user found with the provided email",
      });
    }

    const userData = usersSnapshot.docs[0].data();
    const publicUserData = {
      uid: userData.uid,
      displayName: userData.displayName,
      photoURL: userData.photoURL,
    };

    res.status(200).json({
      status: "success",
      data: publicUserData,
    });
  } catch (error) {
    console.error("Error searching for user:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to search for user",
    });
  }
});

module.exports = router;
