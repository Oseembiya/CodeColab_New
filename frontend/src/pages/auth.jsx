import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaUser,
  FaEnvelope,
  FaLock,
  FaGoogle,
  FaGithub,
  FaTimes,
  FaCheck,
  FaImage,
  FaEye,
  FaEyeSlash,
} from "react-icons/fa";
import { useAuth } from "../contexts/AuthContext";
import "../styles/pages/Auth.css";

const Auth = () => {
  const [activeTab, setActiveTab] = useState("signup");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();
  const { login, signup, loginWithGoogle, loginWithGithub } = useAuth();

  // Login form state
  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });
  // Register form state
  const [registerData, setRegisterData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  // Show password state
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  //  combine the handle for both login and register forms
  const handleFormChange = (setter) => (e) => {
    const { name, value, type, checked } = e.target;
    setter((prevData) => ({
      ...prevData,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // Handle login submission
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!loginData.email || !loginData.password) {
      setError("Please enter both email and password");
      return;
    }

    setIsLoading(true);

    try {
      await login(loginData.email, loginData.password);
      setSuccess("Login successful!");
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Failed to log in");
      setIsLoading(false);
    }
  };

  // Handle registration submission
  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Basic validation
    if (!registerData.name || !registerData.email || !registerData.password) {
      setError("All fields are required");
      return;
    }

    if (registerData.password !== registerData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (registerData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);

    try {
      await signup(
        registerData.email,
        registerData.password,
        registerData.name,
        null, // No photo file
        "" // No bio
      );

      setSuccess("Account created successfully! You can now log in.");
      setIsLoading(false);

      // Show success message for 2 seconds before switching tabs
      setTimeout(() => {
        setSuccess(""); // Clear success message
        setActiveTab("login");
      }, 2000);
    } catch (err) {
      setError(err.message || "Failed to register");
      setIsLoading(false);
    }
  };

  // Handle social authentication
  const handleSocialAuth = async (provider) => {
    setIsLoading(true);
    setError("");

    try {
      if (provider === "Google") {
        await loginWithGoogle();
      } else if (provider === "GitHub") {
        await loginWithGithub();
      }

      setSuccess("Login successful!");
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || `Failed to authenticate with ${provider}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="welcome-banner">
        <h1>CodeColab</h1>
        <p>Real-time collaborative coding platform</p>
      </div>
      <div className="auth-card">
        <div className="auth-tabs">
          <button
            className={`auth-tab ${activeTab === "login" ? "active" : ""}`}
            onClick={() => setActiveTab("login")}
          >
            Sign In
          </button>
          <button
            className={`auth-tab ${activeTab === "register" ? "active" : ""}`}
            onClick={() => setActiveTab("register")}
          >
            Create Account
          </button>
        </div>
        {error && (
          <div className="error-message">
            {error}
            {error.includes("Invalid email or password") && (
              <div className="password-recovery-help">
                <Link to="/reset-password" className="forgot-password-link">
                  Reset your password
                </Link>
              </div>
            )}
          </div>
        )}
        {success && <div className="success-message">{success}</div>}
        {activeTab === "login" ? (
          // Login Form
          <form onSubmit={handleLogin} className="auth-form">
            <div className="form-group">
              <label htmlFor="loginEmail">Email</label>
              <input
                type="email"
                id="loginEmail"
                name="email"
                value={loginData.email}
                onChange={handleFormChange(setLoginData)}
                required
                autoComplete="username"
                placeholder="Your email"
              />
              <span className="input-icon">
                <FaEnvelope />
              </span>
            </div>

            <div className="form-group password-field">
              <label htmlFor="loginPassword">Password</label>
              <input
                type={showLoginPassword ? "text" : "password"}
                id="loginPassword"
                name="password"
                value={loginData.password}
                onChange={handleFormChange(setLoginData)}
                required
                autoComplete="current-password"
                placeholder="************"
                maxLength={12}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowLoginPassword(!showLoginPassword)}
                aria-label={
                  showLoginPassword ? "Hide password" : "Show password"
                }
              >
                {showLoginPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>

            <div className="login-options">
              <div className="remember-me">
                <input
                  type="checkbox"
                  id="rememberMe"
                  name="rememberMe"
                  checked={loginData.rememberMe}
                  onChange={handleFormChange(setLoginData)}
                />
                <label htmlFor="rememberMe">Remember me</label>
              </div>
              <Link to="/reset-password" className="forgot-password">
                Forgot password?
              </Link>
            </div>

            <button type="submit" className="auth-button" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        ) : (
          // Register Form
          <form onSubmit={handleRegister} className="auth-form">
            <div className="form-group">
              <label htmlFor="registerName">Name</label>
              <input
                type="text"
                id="registerName"
                name="name"
                value={registerData.name}
                onChange={handleFormChange(setRegisterData)}
                placeholder="Kevin Collide"
                required
              />
              <span className="input-icon">
                <FaUser />
              </span>
            </div>

            <div className="form-group">
              <label htmlFor="registerEmail">Email</label>
              <input
                type="email"
                id="registerEmail"
                name="email"
                value={registerData.email}
                onChange={handleFormChange(setRegisterData)}
                placeholder="kevincollide@gmail.com"
                required
                autoComplete="email"
              />
              <span className="input-icon">
                <FaEnvelope />
              </span>
            </div>

            <div className="form-group password-field">
              <label htmlFor="registerPassword">Password</label>
              <input
                type={showRegisterPassword ? "text" : "password"}
                id="registerPassword"
                name="password"
                value={registerData.password}
                onChange={handleFormChange(setRegisterData)}
                placeholder="**********"
                required
                autoComplete="new-password"
                maxLength={12}
                aria-hidden="true"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                aria-label={
                  showRegisterPassword ? "Hide password" : "Show password"
                }
              >
                {showRegisterPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>

            <div className="form-group password-field">
              <label htmlFor="registerConfirmPassword">Confirm password</label>
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="registerConfirmPassword"
                name="confirmPassword"
                value={registerData.confirmPassword}
                onChange={handleFormChange(setRegisterData)}
                placeholder="**********"
                required
                autoComplete="new-password"
                maxLength={12}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={
                  showConfirmPassword ? "Hide password" : "Show password"
                }
              >
                {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>

            {registerData.password && registerData.confirmPassword && (
              <div
                className={
                  registerData.password === registerData.confirmPassword
                    ? "passwords-match valid"
                    : "passwords-match invalid"
                }
              >
                {registerData.password === registerData.confirmPassword ? (
                  <>
                    <FaCheck /> Passwords match
                  </>
                ) : (
                  <>
                    <FaTimes /> Passwords do not match
                  </>
                )}
              </div>
            )}

            <button type="submit" className="auth-button" disabled={isLoading}>
              {isLoading ? "Creating Account..." : "Create Account"}
            </button>
          </form>
        )}

        <div className="social-auth">
          <p>Or continue with</p>
          <div className="social-buttons">
            <button
              type="button"
              className="social-button google"
              onClick={() => handleSocialAuth("Google")}
            >
              <FaGoogle /> Google
            </button>
            <button
              type="button"
              className="social-button github"
              onClick={() => handleSocialAuth("GitHub")}
            >
              <FaGithub /> GitHub
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
