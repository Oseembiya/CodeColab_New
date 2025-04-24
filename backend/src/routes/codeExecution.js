const express = require("express");
const router = express.Router();
const axios = require("axios");

// Add axios to package.json dependencies
// npm install axios

const JUDGE0_API_URL =
  process.env.JUDGE0_API_URL || "https://judge0-ce.p.rapidapi.com";

// Sanitize the API key to remove any potential whitespace or invalid characters
const JUDGE0_API_KEY = process.env.RAPIDAPI_KEY
  ? process.env.RAPIDAPI_KEY.trim().replace(/[^\x20-\x7E]/g, "")
  : null;

router.post("/execute", async (req, res) => {
  console.log("API request received at /api/code/execute");
  try {
    // Check if API key is configured
    if (!JUDGE0_API_KEY) {
      return res.status(500).json({
        status: "error",
        message:
          "RapidAPI key is not configured. Please set RAPIDAPI_KEY environment variable.",
      });
    }

    console.log("Using Judge0 API URL:", JUDGE0_API_URL);
    console.log("RapidAPI Key length:", JUDGE0_API_KEY.length);

    const { code, language } = req.body;

    if (!code) {
      return res.status(400).json({
        status: "error",
        message: "No code provided",
      });
    }

    // Map frontend language to Judge0 language ID
    const languageId = mapLanguageToJudge0Id(language);
    console.log(`Executing ${language} code (language ID: ${languageId})`);

    // Submit code to Judge0
    const submission = await axios.post(
      `${JUDGE0_API_URL}/submissions`,
      {
        source_code: code,
        language_id: languageId,
        stdin: req.body.stdin || "",
      },
      {
        headers: {
          "X-RapidAPI-Key": JUDGE0_API_KEY,
          "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
          "Content-Type": "application/json",
        },
      }
    );

    // Get submission token
    const token = submission.data.token;
    console.log("Submission token:", token);

    // Wait for execution to complete
    let result;
    let attempts = 0;

    do {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
      result = await axios.get(`${JUDGE0_API_URL}/submissions/${token}`, {
        headers: {
          "X-RapidAPI-Key": JUDGE0_API_KEY,
          "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
        },
      });
      attempts++;
      console.log(
        `Attempt ${attempts}: Status ID ${result.data.status.id} (${result.data.status.description})`
      );
    } while (result.data.status.id <= 2 && attempts < 10); // Processing or In Queue

    res.json(result.data);
  } catch (error) {
    console.error("Code execution error:", error);

    if (error.response) {
      console.error("Error response data:", error.response.data);
      console.error("Error status:", error.response.status);
      console.error("Error headers:", error.response.headers);

      return res.status(error.response.status || 500).json({
        status: "error",
        message: "Failed to execute code",
        details: error.message,
        rapidapi_error: error.response.data,
      });
    }

    console.error(
      "RapidAPI Key length:",
      JUDGE0_API_KEY ? JUDGE0_API_KEY.length : 0
    );
    console.error("Judge0 API URL:", JUDGE0_API_URL);

    res.status(500).json({
      status: "error",
      message: "Failed to execute code",
      details: error.message,
    });
  }
});

// Helper function to map frontend languages to Judge0 language IDs
function mapLanguageToJudge0Id(language) {
  const languageMap = {
    javascript: 63, // JavaScript Node.js
    typescript: 74, // TypeScript
    python: 71, // Python 3
    java: 62, // Java
    cpp: 54, // C++
    csharp: 51, // C#
  };

  return languageMap[language] || 63; // Default to JavaScript
}

module.exports = router;
