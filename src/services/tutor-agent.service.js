/**
 * @module TutorAgentService
 * @description A facade service that routes tutor agent requests to the appropriate implementation
 * based on feature flags in the config
 */

import config from '../config/config.js';
import logger from '../utils/logger.js';
import openAIService from './openai.service.js';
import agentService from './agent.service.js';

// Import the LangChain implementation conditionally
let agentFlowService = null;
try {
  agentFlowService = await import('./langchain/agent-flow.service.js').then(module => module.default);
  logger.info('LangChain agent flow service loaded successfully');
} catch (error) {
  logger.warn(`LangChain agent flow service could not be loaded: ${error.message}`);
}

class TutorAgentService {
  constructor() {
    this.useLangChain = config.features?.useLangChain || false;
    logger.info(`TutorAgentService initialized with useLangChain=${this.useLangChain}`);
  }
  
  /**
   * Process a user message and generate a tutor response
   * Routes to either LangChain or direct OpenAI implementation based on config
   * 
   * @async
   * @param {string} userMessage - The user's message
   * @param {Object} tutorSession - The tutor session containing subject and ID
   * @param {Array} messageHistory - Previous messages in the conversation
   * @returns {Promise<Object>} - The response and metadata
   */
  async processMessage(userMessage, tutorSession, messageHistory = []) {
    try {
      // Check if we should use LangChain implementation
      if (this.useLangChain && agentFlowService) {
        logger.info(`Using LangChain implementation for session ${tutorSession.id}`);
        
        // Process through LangChain agent flow
        const result = await agentFlowService.executeAgentFlow(
          userMessage,
          tutorSession,
          messageHistory
        );
        
        return {
          content: result.content,
          metadata: {
            implementation: 'langchain',
            ...result.agentState
          }
        };
      } else {
        // Use the original implementation
        logger.info(`Using direct OpenAI implementation for session ${tutorSession.id}`);
        
        // Process through direct OpenAI service
        const response = await openAIService.generateTutorResponse(
          userMessage,
          tutorSession,
          messageHistory
        );
        
        return {
          content: response,
          metadata: {
            implementation: 'openai',
            subject: tutorSession.subject
          }
        };
      }
    } catch (error) {
      logger.error(`Error processing message: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * End a tutor session and clean up resources
   * 
   * @async
   * @param {string} sessionId - The ID of the session to end
   * @returns {Promise<void>}
   */
  async endSession(sessionId) {
    try {
      // If using LangChain, clean up any resources
      if (this.useLangChain && agentFlowService) {
        if (typeof agentFlowService.cleanupSession === 'function') {
          await agentFlowService.cleanupSession(sessionId);
          logger.debug(`Cleaned up LangChain resources for session ${sessionId}`);
        }
      }
      
      // Additional cleanup if needed
    } catch (error) {
      logger.error(`Error ending session ${sessionId}: ${error.message}`);
    }
  }
}

export default new TutorAgentService();