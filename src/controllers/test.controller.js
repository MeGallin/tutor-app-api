/**
 * @module TestController
 * @description Test controller for easily testing LangChain/LangGraph implementation without authentication
 */

import agentFlowService from '../services/langchain/agent-flow.service.js';
import logger from '../utils/logger.js';

/**
 * Test the LangChain agent implementation
 * 
 * @async
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
export const testLangchainAgent = async (req, res) => {
  try {
    // Extract message from request body
    const { message, subject } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required',
      });
    }

    // Create a mock session for testing
    const mockSession = {
      id: `test_${Date.now()}`,
      subject: subject || 'mathematics',
      name: 'Test Tutor',
    };

    logger.info(`Testing LangChain agent with message: ${message}`);

    // Use the agent flow service to process the message
    const response = await agentFlowService.executeAgentFlow(
      message,
      mockSession,
      [] // Empty message history for simplicity
    );

    // Return the response
    return res.status(200).json({
      success: true,
      data: {
        response,
        session: mockSession
      },
    });
  } catch (error) {
    logger.error(`Error in testLangchainAgent: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Failed to process message with LangChain agent',
    });
  }
};