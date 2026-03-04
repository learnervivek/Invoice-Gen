const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const { oauth2Client, getAuthUrl } = require('../config/oauth');
const User = require('../models/User');
const authService = require('../services/authService');

// ─── Email/Password Registration ──────────────────────────────────────────────

const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Basic validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    const { token, user } = await authService.registerUser({ name, email, password });
    res.status(201).json({ token, user });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error);
  }
};

// ─── Email/Password Login ─────────────────────────────────────────────────────

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const { token, user } = await authService.loginUser({ email, password });
    res.json({ token, user });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error);
  }
};

// ─── Google OAuth ─────────────────────────────────────────────────────────────

const googleAuth = (req, res) => {
  const url = getAuthUrl();
  res.json({ url });
};

const googleCallback = async (req, res) => {
  const { code } = req.query;

  if (!code) {
    const errorUrl = process.env.NODE_ENV === 'production' 
      ? `/login?error=no_code`
      : `${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=no_code`;
    return res.redirect(errorUrl);
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    // Find or create user
    let user = await User.findOne({ googleId: userInfo.id });

    if (user) {
      // Update refresh token if provided
      if (tokens.refresh_token) {
        user.refreshToken = tokens.refresh_token;
        await user.save();
      }
    } else {
      // Check if a user with this email already exists (registered via email/password)
      user = await User.findOne({ email: userInfo.email });
      if (user) {
        // Link Google account to existing email/password user
        user.googleId = userInfo.id;
        user.avatar = userInfo.picture || user.avatar;
        if (tokens.refresh_token) {
          user.refreshToken = tokens.refresh_token;
        }
        await user.save();
      } else {
        user = await User.create({
          name: userInfo.name,
          email: userInfo.email,
          googleId: userInfo.id,
          avatar: userInfo.picture || '',
          refreshToken: tokens.refresh_token || '',
        });
      }
    }

    const token = authService.generateToken(user._id);

    // Redirect to frontend with token
    const successUrl = process.env.NODE_ENV === 'production'
      ? `/auth/callback?token=${token}`
      : `${process.env.CLIENT_URL || 'http://localhost:5173'}/auth/callback?token=${token}`;
    res.redirect(successUrl);
  } catch (error) {
    console.error('OAuth callback error:', error.message);
    const failUrl = process.env.NODE_ENV === 'production'
      ? `/login?error=auth_failed`
      : `${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=auth_failed`;
    res.redirect(failUrl);
  }
};

// ─── Get Current User ─────────────────────────────────────────────────────────

const getMe = async (req, res) => {
  res.json({ user: req.user });
};

const updateProfile = async (req, res, next) => {
  try {
    const { name, companyName, address, phone } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, companyName, address, phone },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({ message: 'Profile updated successfully', user });
  } catch (error) {
    next(error);
  }
};

// ─── Logout ───────────────────────────────────────────────────────────────────

const logout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { refreshToken: '' });
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Logout failed' });
  }
};

module.exports = { register, login, googleAuth, googleCallback, getMe, updateProfile, logout };
