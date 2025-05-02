/**
 * @module AgentFlowService
 * @description Implementation of the sequential agent flow as defined in agent-flow.md
 * This is a standalone implementation that can run without LangChain/LangGraph installed
 * but follows the same architectural patterns
 */

import config from '../../config/config.js';
import logger from '../../utils/logger.js';
import openAIService from '../openai.service.js';
import sqliteMemoryService from './sqlite-memory.service.js';
import stateManagerService from './state-manager.service.js';
import promptTemplateService from './prompt-template.service.js';

/**
 * Service to create and manage the sequential agent flow
 */
class AgentFlowService {
  constructor() {
    this.workflows = new Map(); // Map to store compiled workflows by session ID
  }

  /**
   * Create a sequential agent workflow
   *
   * @param {Object} memoryManager - Memory manager for state persistence
   * @returns {Object} - The workflow object for execution
   */
  createAgentFlow(memoryManager = sqliteMemoryService) {
    try {
      logger.info('Creating sequential agent flow');

      // Define the workflow with its sequential steps
      const workflow = {
        nodes: {
          // Start node - equivalent to seqStart_0 in TutorV0.5 Agents.json
          start: async (state, input) => {
            logger.debug(`Starting agent flow for session: ${state.sessionId}`);

            // Create system prompt
            const subjectSpecificPrompt =
              promptTemplateService.createSubjectPromptTemplate(state.subject);

            // Return updated state with prompt
            return {
              ...state,
              systemPrompt: `You are a friendly assistant called ${state.name} who can answer basic questions on ${state.subject}`,
            };
          },

          // Agent node - equivalent to seqAgent_0 in TutorV0.5 Agents.json
          agent: async (state, input) => {
            logger.debug(
              `Processing agent node for session: ${state.sessionId}`,
            );

            // Format the conversation history
            const formattedHistory = [
              { role: 'system', content: state.systemPrompt },
              ...(state.messages || []),
            ];

            // Create a minimal session object for OpenAI service
            const minimalSession = {
              id: state.sessionId,
              subject: state.subject,
            };

            // Process through OpenAI service using the correct method
            let response;
            try {
              logger.debug(
                `Calling OpenAI service for session ${state.sessionId}`,
              );
              response = await openAIService.generateTutorResponse(
                input,
                minimalSession,
                formattedHistory,
              );
              logger.debug(
                `Received response from OpenAI service: ${response.substring(
                  0,
                  50,
                )}...`,
              );
            } catch (modelError) {
              logger.error(
                `Error generating tutor response: ${modelError.message}`,
              );
              logger.error(modelError.stack);
              response =
                "I'm having trouble processing your request. Please try again.";
            }

            // Add to state
            return { ...state, response };
          },

          // Memory node - equivalent to sqliteAgentMemory_0 in TutorV0.5 Agents.json
          memory: async (state) => {
            logger.debug(
              `Processing memory node for session: ${state.sessionId}`,
            );

            if (memoryManager) {
              try {
                // Save the assistant message to memory
                const messageId = `msg_${Date.now()}`;
                await memoryManager.saveMessage(
                  state.sessionId,
                  messageId,
                  'assistant',
                  state.response,
                );

                // Update the messages in state
                const messages = [
                  ...(state.messages || []),
                  { role: 'assistant', content: state.response, id: messageId },
                ];

                // Save checkpoint to memory
                const checkpointId = await memoryManager.saveCheckpoint(
                  state.sessionId,
                  { ...state, messages },
                );
                logger.debug(
                  `Saved checkpoint ${checkpointId} for session ${state.sessionId}`,
                );

                return { ...state, messages, checkpointId };
              } catch (memoryError) {
                logger.error(`Error persisting memory: ${memoryError.message}`);
                return state;
              }
            }

            return state;
          },

          // End node - equivalent to seqEnd_0 in TutorV0.5 Agents.json
          end: async (state) => {
            logger.debug(`Processing end node for session: ${state.sessionId}`);

            // Format the final output
            return {
              content: state.response,
              agentState: {
                subject: state.subject,
                name: state.name,
                checkpointId: state.checkpointId,
              },
              timestamp: new Date().toISOString(),
            };
          },
        },

        // Define the flow execution
        execute: async (state, input) => {
          try {
            // Execute the nodes in sequence
            const startState = await workflow.nodes.start(state, input);
            const agentState = await workflow.nodes.agent(startState, input);
            const memoryState = await workflow.nodes.memory(agentState);
            return await workflow.nodes.end(memoryState);
          } catch (error) {
            logger.error(`Error in workflow execution: ${error.message}`);
            return {
              content:
                'I apologize, but there was an error processing your request.',
              agentState: {
                subject: state.subject,
                name: state.name,
              },
              timestamp: new Date().toISOString(),
              error: error.message,
            };
          }
        },
      };

      return workflow;
    } catch (error) {
      logger.error(`Error creating agent flow: ${error.message}`);
      throw error;
    }
  }

  /**
   * Initialize or get a workflow for a session
   *
   * @param {string} sessionId - The session ID
   * @returns {Object} - The workflow for this session
   */
  getOrCreateWorkflow(sessionId) {
    if (!this.workflows.has(sessionId)) {
      const workflow = this.createAgentFlow();
      this.workflows.set(sessionId, workflow);
      logger.debug(`Created new workflow for session: ${sessionId}`);
      return workflow;
    }

    return this.workflows.get(sessionId);
  }

  /**
   * Execute the agent workflow
   *
   * @async
   * @param {string} userMessage - The user's message
   * @param {Object} tutorSession - The tutor session containing subject and ID
   * @param {Array} messageHistory - Previous messages in the conversation
   * @returns {Promise<Object>} - The workflow output
   */
  async executeAgentFlow(userMessage, tutorSession, messageHistory = []) {
    try {
      // Get or create workflow for this session
      const workflow = this.getOrCreateWorkflow(tutorSession.id);

      // Transform message history into the format expected by the model
      const formattedHistory = this._formatMessageHistory(messageHistory);

      // Check if we have stored state for this session
      let initialState = null;
      try {
        initialState = await sqliteMemoryService.loadCheckpoint(
          tutorSession.id,
        );
        if (initialState) {
          logger.debug(`Loaded existing state for session ${tutorSession.id}`);
        }
      } catch (error) {
        logger.warn(
          `Could not load checkpoint for session ${tutorSession.id}: ${error.message}`,
        );
      }

      // Initialize state with loaded state or defaults
      const state = initialState || {
        subject: tutorSession.subject || 'various subjects',
        name: tutorSession.name || 'AI Tutor',
        messages: formattedHistory,
        sessionId: tutorSession.id,
      };

      // Save user message to memory
      try {
        const messageId = `msg_${Date.now()}`;
        await sqliteMemoryService.saveMessage(
          tutorSession.id,
          messageId,
          'user',
          userMessage,
        );

        // Add the new message to the state
        state.messages = [
          ...(state.messages || []),
          { role: 'user', content: userMessage, id: messageId },
        ];
      } catch (error) {
        logger.error(`Error saving user message: ${error.message}`);
      }

      // Execute the workflow
      const result = await workflow.execute(state, userMessage);
      return result;
    } catch (error) {
      logger.error(`Error executing agent flow: ${error.message}`);
      logger.debug(error.stack);

      // Return a fallback response if something goes wrong
      return {
        content:
          'I apologize, but there was an error processing your request. The system is being updated. Please try again later.',
        agentState: {
          subject: tutorSession.subject || 'various subjects',
          name: tutorSession.name || 'AI Tutor',
        },
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  /**
   * Format message history for the model
   *
   * @private
   * @param {Array} messageHistory - The raw message history
   * @returns {Array} - Formatted message history
   */
  _formatMessageHistory(messageHistory) {
    if (!messageHistory || !messageHistory.length) {
      return [];
    }

    return messageHistory.map((message) => ({
      role: message.role,
      content: message.content,
      id:
        message.id ||
        `legacy_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
    }));
  }

  /**
   * Clean up resources for a session
   *
   * @param {string} sessionId - The session ID to clean up
   */
  cleanupSession(sessionId) {
    this.workflows.delete(sessionId);
    logger.debug(`Cleaned up workflow for session: ${sessionId}`);
  }
}

export default new AgentFlowService();
