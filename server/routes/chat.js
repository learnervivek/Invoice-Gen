const express = require('express');
const { processMessage } = require('../controllers/chatController');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/message', auth, processMessage);

module.exports = router;
