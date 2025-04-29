/**
 * @module AgentService
 * @description Service to handle the integration with TutorV0.5 Agents flow
 */

import config from '../config/config.js';
import logger from '../utils/logger.js';
import openAIService from './openai.service.js';

class AgentService {
  /**
   * Process a message using the TutorV0.5 Agent flow
   *
   * @async
   * @param {string} userMessage - The user's message
   * @param {Object} tutorSession - The tutor session object
   * @param {Array} messageHistory - Previous messages in the conversation
   * @returns {Promise<Object>} - The assistant's response and any metadata
   * @throws {Error} - If message processing fails
   */
  async processMessage(userMessage, tutorSession, messageHistory) {
    try {
      // Create agent state based on the TutorV0.5 Agents.json flow
      const agentState = {
        subject: tutorSession.subject || 'various subjects',
        name: 'AI Tutor',
      };

      logger.info(
        `Processing message for session ${
          tutorSession.id
        } with agent state: ${JSON.stringify(agentState)}`,
      );

      // Generate a system message that incorporates the agent state
      const systemMessage = `You are a friendly assistant called ${agentState.name} who can answer basic questions on ${agentState.subject}`;

      // Prepare the conversation history for the OpenAI service
      const formattedHistory = this._formatConversationHistory(
        messageHistory,
        systemMessage,
      );

      // Get response from OpenAI
      const response = await openAIService.generateTutorResponse(
        userMessage,
        tutorSession,
        formattedHistory,
      );

      // Return response with metadata
      return {
        content: response,
        agentState,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(
        `Error processing message through agent flow: ${error.message}`,
      );
      logger.debug(error.stack);
      throw error; // Re-throw to let controller handle the error
    }
  }

  /**
   * Format conversation history according to the agent flow requirements
   *
   * @private
   * @param {Array} messageHistory - The raw message history
   * @param {string} systemMessage - The system message to use
   * @returns {Array} - Formatted conversation history
   */
  _formatConversationHistory(messageHistory, systemMessage) {
    const formattedHistory = [];

    // Add system message at the beginning
    formattedHistory.push({
      role: 'system',
      content: systemMessage,
    });

    // Add message history (excluding system messages as we've already added our own)
    if (messageHistory && messageHistory.length > 0) {
      messageHistory.forEach((message) => {
        if (message.role !== 'system') {
          formattedHistory.push({
            role: message.role,
            content: message.content,
          });
        }
      });
    }

    return formattedHistory;
  }

  /**
   * Initialize a new tutor session with appropriate agent state
   *
   * @param {Object} tutorSession - The tutor session object
   * @returns {Object} - Initial agent state
   */
  initializeSessionState(tutorSession) {
    // Set initial agent state based on TutorV0.5 Agents.json
    const initialState = {
      subject: tutorSession.subject || 'various subjects',
      name: 'AI Tutor',
      created: new Date().toISOString(),
    };

    logger.info(
      `Initialized agent state for session ${tutorSession.id}: ${JSON.stringify(
        initialState,
      )}`,
    );

    return initialState;
  }
}

export default new AgentService();
