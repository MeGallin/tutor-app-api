/**
 * @module StateManager
 * @description State management for the agent workflow following the LangChain/LangGraph architecture
 */

import logger from '../../utils/logger.js';
import sqliteMemoryService from './sqlite-memory.service.js';

/**
 * Class to handle state management for the agent workflow
 */
class StateManagerService {
  constructor() {
    // Default schema that matches the FlowiseAI implementation
    this.defaultSchema = {
      subject: { default: 'test-subject' },
      name: { default: 'Erica' },
      messages: { default: [] },
      sessionId: { default: null },
    };
  }

  /**
   * Create a state manager for the workflow
   *
   * @param {Object} initialState - Optional initial state
   * @returns {Object} - The state manager object
   */
  async createStateManager(initialState = {}) {
    try {
      // Try to get schema from SQLite memory service
      let stateSchema = this.defaultSchema;

      try {
        const dbSchema = await sqliteMemoryService.getDefaultSchema();
        if (dbSchema && Object.keys(dbSchema).length > 0) {
          stateSchema = { ...stateSchema, ...dbSchema };
          logger.debug('Retrieved state schema from database');
        }
      } catch (error) {
        logger.warn(
          `Could not retrieve schema from database, using default: ${error.message}`,
        );
      }

      // Override defaults with provided initial state
      Object.keys(initialState).forEach((key) => {
        if (stateSchema[key]) {
          stateSchema[key].default = initialState[key];
        } else {
          stateSchema[key] = { default: initialState[key] };
        }
      });

      // Create the state manager
      const stateManager = {
        schema: stateSchema,
        getState: () => {
          // Create a state object based on the schema
          const state = {};
          Object.keys(stateSchema).forEach((key) => {
            state[key] = stateSchema[key].default;
          });
          return state;
        },
        setState: (newState) => {
          // Update the schema defaults
          Object.keys(newState).forEach((key) => {
            if (stateSchema[key]) {
              stateSchema[key].default = newState[key];
            } else {
              stateSchema[key] = { default: newState[key] };
            }
          });
          return stateManager.getState();
        },
        // Enhanced methods for future LangGraph compatibility
        addNode: (name, fn) => {
          logger.info(
            `Node ${name} would be added in full LangGraph implementation`,
          );
          return stateManager;
        },
        addEdge: (from, to) => {
          logger.info(
            `Edge from ${from} to ${to} would be added in full LangGraph implementation`,
          );
          return stateManager;
        },
        compile: () => {
          logger.info(
            'StateGraph would be compiled in full LangGraph implementation',
          );
          return {
            invoke: async (state) => {
              return stateManager.setState(state);
            },
          };
        },
      };

      logger.info('StateManager created successfully');
      return stateManager;
    } catch (error) {
      logger.error(`Error creating StateManager: ${error.message}`);
      throw error;
    }
  }

  /**
   * Merge updates into an existing state
   *
   * @param {Object} currentState - The current state
   * @param {Object} updates - The updates to apply
   * @returns {Object} - The updated state
   */
  updateState(currentState, updates) {
    try {
      // Create a deep copy of the current state to avoid direct mutation
      const updatedState = JSON.parse(JSON.stringify(currentState));

      // Apply updates
      Object.keys(updates).forEach((key) => {
        if (
          key === 'messages' &&
          Array.isArray(updatedState.messages) &&
          Array.isArray(updates.messages)
        ) {
          // For messages, we want to append rather than replace
          updatedState.messages = [
            ...updatedState.messages,
            ...updates.messages,
          ];
        } else {
          updatedState[key] = updates[key];
        }
      });

      return updatedState;
    } catch (error) {
      logger.error(`Error updating state: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save the current state as a checkpoint
   *
   * @async
   * @param {Object} state - Current state object
   * @param {string} sessionId - Session ID
   * @returns {Promise<string>} - Checkpoint ID
   */
  async saveStateCheckpoint(state, sessionId) {
    try {
      return await sqliteMemoryService.saveCheckpoint(sessionId, state);
    } catch (error) {
      logger.error(`Error saving state checkpoint: ${error.message}`);
      throw error;
    }
  }

  /**
   * Load a state checkpoint
   *
   * @async
   * @param {string} sessionId - Session ID
   * @param {string} checkpointId - Optional checkpoint ID
   * @returns {Promise<Object>} - The loaded state
   */
  async loadStateCheckpoint(sessionId, checkpointId = null) {
    try {
      return await sqliteMemoryService.loadCheckpoint(sessionId, checkpointId);
    } catch (error) {
      logger.error(`Error loading state checkpoint: ${error.message}`);
      throw error;
    }
  }
}

export default new StateManagerService();
