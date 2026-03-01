const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const { oauth2Client, getAuthUrl } = require('../config/oauth');
const User = require('../models/User');

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// Redirect to Google consent screen
const googleAuth = (req, res) => {
  const url = getAuthUrl();
  res.json({ url });
};

// Handle Google OAuth callback
const googleCallback = async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.redirect(`${process.env.CLIENT_URL}/login?error=no_code`);
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
      user = await User.create({
        name: userInfo.name,
        email: userInfo.email,
        googleId: userInfo.id,
        avatar: userInfo.picture || '',
        refreshToken: tokens.refresh_token || '',
      });
    }

    const token = generateToken(user._id);

    // Redirect to frontend with token
    res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}`);
  } catch (error) {
    console.error('OAuth callback error:', error.message);
    res.redirect(`${process.env.CLIENT_URL}/login?error=auth_failed`);
  }
};

// Get current user
const getMe = async (req, res) => {
  res.json({ user: req.user });
};

// Logout (client-side token removal, but we can clear refresh token)
const logout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { refreshToken: '' });
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Logout failed' });
  }
};

module.exports = { googleAuth, googleCallback, getMe, logout };
