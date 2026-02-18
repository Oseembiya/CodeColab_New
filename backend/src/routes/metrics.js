const express = require("express");
const router = express.Router();
const { db } = require("../config/firebase");
//const {  } = require("../middleware/auth");

// Get user metrics
router.get("/", async (req, res) => {
  try {
    const userRef = db.collection("users").doc(req.user.uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    const userData = userDoc.data();

    // Get metrics or initialize if not exist
    const metrics = userData.metrics || {
      totalSessions: 0,
      hoursSpent: 0,
      linesOfCode: 0,
      collaborations: 0,
      lastUpdated: new Date(),
    };

    res.status(200).json({
      status: "success",
      data: metrics,
    });
  } catch (error) {
    console.error("Error fetching user metrics:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch user metrics",
    });
  }
});

// Update user metrics
router.put("/" async (req, res) => {
  try {
    const { metricsUpdate } = req.body;
    const userRef = db.collection("users").doc(req.user.uid);

    // Get current user data
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    const userData = userDoc.data();
    const currentMetrics = userData.metrics || {
      totalSessions: 0,
      hoursSpent: 0,
      linesOfCode: 0,
      collaborations: 0,
      lastUpdated: new Date(),
    };

    // Update metrics with new values
    const updatedMetrics = {
      ...currentMetrics,
      ...metricsUpdate,
      lastUpdated: new Date(),
    };

    // Update user document with new metrics
    await userRef.update({ metrics: updatedMetrics });

    res.status(200).json({
      status: "success",
      data: updatedMetrics,
    });
  } catch (error) {
    console.error("Error updating user metrics:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to update user metrics",
    });
  }
});

// Increment specific metric fields
router.post("/increment",async (req, res) => {
  try {
    const { increments } = req.body;
    const userRef = db.collection("users").doc(req.user.uid);

    // Transaction to safely update metrics
    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists) {
        throw new Error("User not found");
      }

      const userData = userDoc.data();
      const currentMetrics = userData.metrics || {
        totalSessions: 0,
        hoursSpent: 0,
        linesOfCode: 0,
        collaborations: 0,
        lastUpdated: new Date(),
      };

      // Apply increments
      const updatedMetrics = { ...currentMetrics };

      for (const [key, value] of Object.entries(increments)) {
        if (key in currentMetrics && typeof value === "number") {
          updatedMetrics[key] = (currentMetrics[key] || 0) + value;
        }
      }

      updatedMetrics.lastUpdated = new Date();

      // Update the document
      transaction.update(userRef, { metrics: updatedMetrics });

      return updatedMetrics;
    });

    const updatedUserDoc = await userRef.get();
    const updatedMetrics = updatedUserDoc.data().metrics;

    res.status(200).json({
      status: "success",
      data: updatedMetrics,
    });
  } catch (error) {
    console.error("Error incrementing metrics:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to increment metrics",
    });
  }
});

module.exports = router;
