const express = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const chatbotService = require('../services/chatbotService');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * POST /api/chatbot/conversations
 * Create new conversation
 */
router.post('/conversations', authenticate, async (req, res, next) => {
  try {
    const { title } = req.body || {};
    const conversation = await chatbotService.createConversation(
      req.user.id,
      title
    );

    logger.info('Conversation created', {
      requestId: req.requestId,
      conversationId: conversation.id,
      userId: req.user.id
    });

    res.status(201).json({
      status: 'success',
      conversation,
      requestId: req.requestId
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/chatbot/conversations
 * Get all conversations for current user
 */
router.get('/conversations', authenticate, async (req, res, next) => {
  try {
    const conversations = await chatbotService.getUserConversations(req.user.id);

    res.json({
      status: 'success',
      conversations,
      requestId: req.requestId
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/chatbot/conversations/:id
 * Get conversation with messages
 */
router.get('/conversations/:id', authenticate, async (req, res, next) => {
  try {
    const conversation = await chatbotService.getConversation(
      req.params.id,
      req.user.id
    );

    if (!conversation) {
      return res.status(404).json({
        status: 'error',
        message: 'Conversation not found',
        requestId: req.requestId
      });
    }

    res.json({
      status: 'success',
      conversation,
      requestId: req.requestId
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/chatbot/conversations/:id/messages
 * Send message to conversation
 */
router.post('/conversations/:id/messages', authenticate, async (req, res, next) => {
  try {
    const { message } = req.body || {};

    if (!message || !message.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'Message content required',
        requestId: req.requestId
      });
    }

    const response = await chatbotService.sendMessage(
      req.params.id,
      req.user.id,
      message.trim(),
      req.requestId
    );

    res.json({
      status: 'success',
      message: response,
      requestId: req.requestId
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/chatbot/conversations/:id
 * Delete conversation and all its messages
 */
router.delete('/conversations/:id', authenticate, async (req, res, next) => {
  try {
    const deleted = await chatbotService.deleteConversation(
      req.params.id,
      req.user.id
    );

    if (!deleted) {
      return res.status(404).json({
        status: 'error',
        message: 'Conversation not found or access denied',
        requestId: req.requestId
      });
    }

    logger.info('Conversation deleted', {
      requestId: req.requestId,
      conversationId: req.params.id,
      userId: req.user.id
    });

    res.json({
      status: 'success',
      message: 'Conversation deleted successfully',
      requestId: req.requestId
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
