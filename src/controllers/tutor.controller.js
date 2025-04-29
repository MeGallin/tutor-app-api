/**
 * @module TutorController
 * @description Controller handling tutor session management and message processing
 */

import db from '../models/index.js';
import { APIError } from '../middleware/error.js';
import logger from '../utils/logger.js';
import config from '../config/config.js';
import agentService from '../services/agent.service.js';

const TutorSession = db.TutorSession;
const Message = db.Message;

/**
 * Create a new tutor session
 * @async
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const createSession = async (req, res, next) => {
  try {
    const { subject } = req.body;
    const userId = req.user.id;

    // Input validation
    if (!subject) {
      throw new APIError('Subject is required', 400);
    }

    // Create session
    const session = await TutorSession.create({
      subject,
      userId,
      title: `${subject} Session`, // Provide a better default title
    });

    // Initialize agent state for the session
    const initialState = agentService.initializeSessionState(session);

    // Add initial system message to set context
    await Message.create({
      sessionId: session.id,
      content: `Welcome to your tutoring session on ${subject}. How can I help you today?`,
      role: 'system',
      metadata: { agentState: initialState },
    });

    logger.info(`New tutor session created: ${session.id} for user: ${userId}`);

    res.status(201).json({
      success: true,
      data: session,
    });
  } catch (error) {
    logger.error(`Create session error: ${error.message}`);
    next(error);
  }
};

/**
 * Get all sessions for the current user
 * @async
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const getSessions = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const sessions = await TutorSession.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      attributes: {
        include: [
          [
            db.sequelize.literal(
              '(SELECT COUNT(*) FROM Messages WHERE Messages.sessionId = TutorSession.id)',
            ),
            'messageCount',
          ],
        ],
      },
    });

    logger.debug(`Retrieved ${sessions.length} sessions for user: ${userId}`);

    res.status(200).json({
      success: true,
      count: sessions.length,
      data: sessions,
    });
  } catch (error) {
    logger.error(`Get sessions error: ${error.message}`);
    next(error);
  }
};

/**
 * Get a single session by ID
 * @async
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const getSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Input validation
    if (!id) {
      throw new APIError('Session ID is required', 400);
    }

    const session = await TutorSession.findOne({
      where: { id, userId },
      include: [
        {
          model: Message,
          order: [['createdAt', 'ASC']],
        },
      ],
    });

    if (!session) {
      throw new APIError('Session not found', 404);
    }

    logger.debug(`Retrieved session: ${id} for user: ${userId}`);

    res.status(200).json({
      success: true,
      data: session,
    });
  } catch (error) {
    logger.error(`Get session error: ${error.message}`);
    next(error);
  }
};

/**
 * Send a message in a session and get a tutor response
 * @async
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const sendMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    // Input validation
    if (!id) {
      throw new APIError('Session ID is required', 400);
    }

    if (!content || content.trim() === '') {
      throw new APIError('Message content is required', 400);
    }

    // Verify session exists and belongs to user
    const session = await TutorSession.findOne({
      where: { id, userId },
      include: [
        {
          model: Message,
          order: [['createdAt', 'ASC']],
        },
      ],
    });

    if (!session) {
      throw new APIError('Session not found', 404);
    }

    // Check if session is already ended
    if (session.endedAt) {
      throw new APIError('Cannot send messages in an ended session', 400);
    }

    // Save user message
    const userMessage = await Message.create({
      sessionId: id,
      content,
      role: 'user',
    });

    logger.debug(`User message saved in session: ${id}`);

    // Get message history for context
    const messageHistory = session.Messages || [];

    try {
      // Process message through the agent service
      const agentResponse = await agentService.processMessage(
        content,
        session,
        messageHistory,
      );

      // Save assistant response
      const assistantMessage = await Message.create({
        sessionId: id,
        content: agentResponse.content,
        role: 'assistant',
        metadata: {
          model: config.openAI.defaultModel,
          agentState: agentResponse.agentState,
          timestamp: agentResponse.timestamp || new Date().toISOString(),
        },
      });

      logger.debug(`Assistant response saved for session: ${id}`);

      res.status(200).json({
        success: true,
        data: {
          userMessage,
          assistantMessage,
        },
      });
    } catch (error) {
      // Even if agent processing fails, we've already saved the user message
      // Let's return an error message as the assistant response
      logger.error(`Failed to get AI response: ${error.message}`);

      const errorMessage = await Message.create({
        sessionId: id,
        content:
          "I'm sorry, I'm having trouble processing your request right now. Please try again in a moment.",
        role: 'assistant',
        metadata: {
          error: true,
          errorMessage: error.message,
        },
      });

      res.status(200).json({
        success: true,
        data: {
          userMessage,
          assistantMessage: errorMessage,
          error: true,
        },
      });
    }
  } catch (error) {
    logger.error(`Send message error: ${error.message}`);
    next(error);
  }
};

/**
 * End a session
 * @async
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const endSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Input validation
    if (!id) {
      throw new APIError('Session ID is required', 400);
    }

    const session = await TutorSession.findOne({
      where: { id, userId },
    });

    if (!session) {
      throw new APIError('Session not found', 404);
    }

    if (session.endedAt) {
      throw new APIError('Session is already ended', 400);
    }

    session.endedAt = new Date();
    await session.save();

    logger.info(`Session ended: ${id}`);

    // Add a final system message
    await Message.create({
      sessionId: id,
      content:
        'This tutoring session has ended. Thank you for learning with us!',
      role: 'system',
    });

    res.status(200).json({
      success: true,
      data: session,
    });
  } catch (error) {
    logger.error(`End session error: ${error.message}`);
    next(error);
  }
};

export { createSession, getSessions, getSession, sendMessage, endSession };
