const express = require('express');
const { googleAuth, googleCallback, getMe, logout } = require('../controllers/authController');
const auth = require('../middleware/auth');

const router = express.Router();

// Google OAuth
router.get('/google', googleAuth);
router.get('/google/callback', googleCallback);

// Protected routes
router.get('/me', auth, getMe);
router.post('/logout', auth, logout);

module.exports = router;
