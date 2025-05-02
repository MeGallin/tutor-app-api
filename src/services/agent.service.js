/**
 * @module AgentService
 * @description Service to handle the integration with TutorV0.5 Agents flow
 */

import config from '../config/config.js';
import logger from '../utils/logger.js';
import openAIService from './openai.service.js';
import agentFlowService from './langchain/agent-flow.service.js';
import sqliteMemoryService from './langchain/sqlite-memory.service.js';
import stateManagerService from './langchain/state-manager.service.js';

class AgentService {
  constructor() {
    // Initialize the SQLite memory service
    this.initializeMemoryService();
  }

  /**
   * Initialize the SQLite memory service
   *
   * @async
   * @private
   */
  async initializeMemoryService() {
    try {
      await sqliteMemoryService.initialize();
      logger.info('SQLiteAgentMemory service initialized');
    } catch (error) {
      logger.error(
        `Error initializing SQLiteAgentMemory service: ${error.message}`,
      );
      logger.warn('Falling back to non-persistent memory');
    }
  }

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
      // Check if LangChain implementation should be used
      if (config.features?.useLangChain === true) {
        // Use the LangGraph implementation
        logger.info(
          `Processing message with LangChain/LangGraph for session ${tutorSession.id}`,
        );

        const response = await agentFlowService.executeAgentFlow(
          userMessage,
          tutorSession,
          messageHistory,
        );

        return response;
      } else {
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
      }
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
    // Check if LangChain implementation should be used
    if (config.features?.useLangChain === true) {
      // Create a state manager using LangGraph
      logger.info(
        `Initializing state manager for session ${tutorSession.id} with LangChain/LangGraph`,
      );

      const initialState = {
        subject: tutorSession.subject || 'various subjects',
        name: 'AI Tutor',
        messages: [],
        sessionId: tutorSession.id,
        created: new Date().toISOString(),
      };

      // Create a StateManager instance
      const stateManager = stateManagerService.createStateManager(initialState);

      // Save initial state checkpoint
      sqliteMemoryService
        .saveCheckpoint(tutorSession.id, initialState)
        .catch((err) =>
          logger.error(`Failed to save initial checkpoint: ${err.message}`),
        );

      return initialState;
    } else {
      // Set initial agent state based on TutorV0.5 Agents.json
      const initialState = {
        subject: tutorSession.subject || 'various subjects',
        name: 'AI Tutor',
        created: new Date().toISOString(),
      };

      logger.info(
        `Initialized agent state for session ${
          tutorSession.id
        }: ${JSON.stringify(initialState)}`,
      );

      return initialState;
    }
  }
}

export default new AgentService();
