import { useState } from "react";
import { Link } from "react-router-dom";
import { FaEnvelope, FaLock, FaGoogle, FaGithub } from "react-icons/fa";
import "../styles/pages/Login.css";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }

    setIsLoading(true);

    try {
      // Simulate authentication - would use Firebase in production
      setTimeout(() => {
        console.log("Logging in with:", { email, password });
        setIsLoading(false);
        // Redirect would happen via Firebase auth context
      }, 1500);
    } catch (err) {
      setError(err.message || "Failed to log in");
      setIsLoading(false);
    }
  };

  const handleSocialLogin = (provider) => {
    // Simulated social login - would use Firebase auth providers
    console.log(`Logging in with ${provider}`);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Welcome to CodeColab</h1>
          <p>Sign in to continue to your account</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label htmlFor="email">
              <FaEnvelope /> Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              <FaLock /> Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          <div className="login-options">
            <div className="remember-me">
              <input type="checkbox" id="remember" />
              <label htmlFor="remember">Remember me</label>
            </div>
            <Link to="/reset-password" className="forgot-password">
              Forgot password?
            </Link>
          </div>

          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="social-login">
          <p>Or sign in with</p>
          <div className="social-buttons">
            <button
              type="button"
              className="social-button google"
              onClick={() => handleSocialLogin("Google")}
            >
              <FaGoogle /> Google
            </button>
            <button
              type="button"
              className="social-button github"
              onClick={() => handleSocialLogin("GitHub")}
            >
              <FaGithub /> GitHub
            </button>
          </div>
        </div>

        <div className="register-prompt">
          <p>
            Don't have an account?{" "}
            <Link to="/register" className="register-link">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
