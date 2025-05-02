import express from 'express';
import {
  createSession,
  getSessions,
  getSession,
  sendMessage,
  endSession,
} from '../controllers/tutor.controller.js';
import { testLangchainAgent } from '../controllers/test.controller.js';
import { verifyToken, authorize } from '../middleware/auth.js';

const router = express.Router();

// Test route for LangChain that doesn't require authentication
router.post('/test/langchain', testLangchainAgent);

// All routes require authentication
router.use(verifyToken);

/**
 * @swagger
 * /api/tutor/sessions:
 *   post:
 *     summary: Create a new tutor session
 *     tags: [Tutor]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               subject:
 *                 type: string
 *     responses:
 *       201:
 *         description: Session created successfully
 *       401:
 *         description: Not authenticated
 */
router.post('/sessions', createSession);

/**
 * @swagger
 * /api/tutor/sessions:
 *   get:
 *     summary: Get all tutor sessions for the current user
 *     tags: [Tutor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of sessions
 *       401:
 *         description: Not authenticated
 */
router.get('/sessions', getSessions);

/**
 * @swagger
 * /api/tutor/sessions/{id}:
 *   get:
 *     summary: Get a single session by ID
 *     tags: [Tutor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Session ID
 *     responses:
 *       200:
 *         description: Session details with messages
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Session not found
 */
router.get('/sessions/:id', getSession);

/**
 * @swagger
 * /api/tutor/sessions/{id}/message:
 *   post:
 *     summary: Send a message in a session and get a tutor response
 *     tags: [Tutor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Session ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Message sent and response received
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Session not found
 */
router.post('/sessions/:id/message', sendMessage);

/**
 * @swagger
 * /api/tutor/sessions/{id}/end:
 *   put:
 *     summary: End a tutor session
 *     tags: [Tutor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Session ID
 *     responses:
 *       200:
 *         description: Session ended successfully
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Session not found
 */
router.put('/sessions/:id/end', endSession);

export default router;
