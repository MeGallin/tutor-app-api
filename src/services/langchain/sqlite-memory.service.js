/**
 * @module SQLiteAgentMemory
 * @description SQLite-based memory system for storing and retrieving agent state and conversation history
 * Implementation following the LangChain/LangGraph architecture defined in agent-flow.md
 */

import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import config from '../../config/config.js';
import logger from '../../utils/logger.js';

class SQLiteAgentMemory {
  constructor() {
    this.dbPath =
      config.database?.path || path.join(process.cwd(), 'data', 'tutor.sqlite');
    this.db = null;
    this.stateCache = new Map(); // In-memory cache for frequent state lookups
  }

  /**
   * Initialize the database connection and create required tables if they don't exist
   *
   * @async
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Create a new database connection
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          logger.error(`Error connecting to SQLite database: ${err.message}`);
          throw err;
        }
        logger.info(`Connected to SQLite database at ${this.dbPath}`);
      });

      // Promisify the necessary database methods
      this.dbRun = promisify(this.db.run).bind(this.db);
      this.dbGet = promisify(this.db.get).bind(this.db);
      this.dbAll = promisify(this.db.all).bind(this.db);

      // Create memory table if it doesn't exist
      await this.dbRun(`
        CREATE TABLE IF NOT EXISTS agent_memories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL,
          checkpoint_id TEXT,
          state_data TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(session_id, checkpoint_id)
        )
      `);

      // Create conversation history table if it doesn't exist
      await this.dbRun(`
        CREATE TABLE IF NOT EXISTS agent_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL,
          message_id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(session_id, message_id)
        )
      `);

      // Create agent state schema table
      await this.dbRun(`
        CREATE TABLE IF NOT EXISTS agent_schema (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT NOT NULL,
          default_value TEXT,
          type TEXT NOT NULL,
          UNIQUE(key)
        )
      `);

      // Initialize default schema values if needed
      await this._initializeDefaultSchema();

      logger.info('SQLiteAgentMemory initialized successfully');
    } catch (error) {
      logger.error(`Error initializing SQLiteAgentMemory: ${error.message}`);
      throw error;
    }
  }

  /**
   * Initialize default schema values for the agent
   *
   * @private
   * @async
   * @returns {Promise<void>}
   */
  async _initializeDefaultSchema() {
    const defaultSchema = [
      { key: 'subject', default_value: 'test-subject', type: 'string' },
      { key: 'name', default_value: 'Erica', type: 'string' },
      { key: 'messages', default_value: '[]', type: 'array' },
    ];

    for (const item of defaultSchema) {
      try {
        await this.dbRun(
          'INSERT OR IGNORE INTO agent_schema (key, default_value, type) VALUES (?, ?, ?)',
          [item.key, item.default_value, item.type],
        );
      } catch (error) {
        logger.error(
          `Error initializing schema value for ${item.key}: ${error.message}`,
        );
      }
    }
  }

  /**
   * Save an agent state checkpoint to the database
   *
   * @async
   * @param {string} sessionId - The session ID
   * @param {Object} state - The state object to save
   * @param {string} checkpointId - Optional checkpoint ID
   * @returns {Promise<string>} - The checkpoint ID
   */
  async saveCheckpoint(sessionId, state, checkpointId = null) {
    if (!this.db) {
      await this.initialize();
    }

    try {
      // Generate a checkpoint ID if not provided
      if (!checkpointId) {
        checkpointId = `ckpt_${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 15)}`;
      }

      // Convert state object to JSON string
      const stateData = JSON.stringify(state);

      // Insert or replace checkpoint in database
      await this.dbRun(
        'INSERT OR REPLACE INTO agent_memories (session_id, checkpoint_id, state_data) VALUES (?, ?, ?)',
        [sessionId, checkpointId, stateData],
      );

      // Update cache
      this.stateCache.set(`${sessionId}:${checkpointId}`, state);

      logger.debug(
        `Checkpoint saved for session ${sessionId} with ID ${checkpointId}`,
      );
      return checkpointId;
    } catch (error) {
      logger.error(
        `Error saving checkpoint for session ${sessionId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Load a state checkpoint from the database
   *
   * @async
   * @param {string} sessionId - The session ID
   * @param {string} checkpointId - Optional checkpoint ID. If not provided, loads the latest checkpoint
   * @returns {Promise<Object>} - The loaded state
   */
  async loadCheckpoint(sessionId, checkpointId = null) {
    if (!this.db) {
      await this.initialize();
    }

    try {
      // Check cache first
      const cacheKey = `${sessionId}:${checkpointId || 'latest'}`;
      if (this.stateCache.has(cacheKey)) {
        return this.stateCache.get(cacheKey);
      }

      let query = 'SELECT state_data FROM agent_memories WHERE session_id = ?';
      let params = [sessionId];

      if (checkpointId) {
        query += ' AND checkpoint_id = ?';
        params.push(checkpointId);
      } else {
        // Get the latest checkpoint if no specific ID provided
        query += ' ORDER BY created_at DESC LIMIT 1';
      }

      const result = await this.dbGet(query, params);

      if (!result) {
        logger.warn(
          `No checkpoint found for session ${sessionId}${
            checkpointId ? ` with ID ${checkpointId}` : ''
          }`,
        );
        return null;
      }

      const state = JSON.parse(result.state_data);

      // Update cache
      this.stateCache.set(cacheKey, state);

      return state;
    } catch (error) {
      logger.error(
        `Error loading checkpoint for session ${sessionId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Save a message to the conversation history
   *
   * @async
   * @param {string} sessionId - The session ID
   * @param {string} messageId - The message ID
   * @param {string} role - The message role (user, assistant, system, etc.)
   * @param {string} content - The message content
   * @returns {Promise<void>}
   */
  async saveMessage(sessionId, messageId, role, content) {
    if (!this.db) {
      await this.initialize();
    }

    try {
      await this.dbRun(
        'INSERT OR REPLACE INTO agent_messages (session_id, message_id, role, content) VALUES (?, ?, ?, ?)',
        [sessionId, messageId, role, content],
      );

      logger.debug(`Message saved for session ${sessionId} with role ${role}`);
    } catch (error) {
      logger.error(
        `Error saving message for session ${sessionId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get messages from the conversation history for a session
   *
   * @async
   * @param {string} sessionId - The session ID
   * @param {number} limit - Maximum number of messages to retrieve
   * @returns {Promise<Array<Object>>} - The messages
   */
  async getMessages(sessionId, limit = 100) {
    if (!this.db) {
      await this.initialize();
    }

    try {
      const messages = await this.dbAll(
        'SELECT message_id, role, content, timestamp FROM agent_messages WHERE session_id = ? ORDER BY timestamp ASC LIMIT ?',
        [sessionId, limit],
      );

      return messages.map((msg) => ({
        id: msg.message_id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
      }));
    } catch (error) {
      logger.error(
        `Error retrieving messages for session ${sessionId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get the default schema for agent state
   *
   * @async
   * @returns {Promise<Object>} - The default schema
   */
  async getDefaultSchema() {
    if (!this.db) {
      await this.initialize();
    }

    try {
      const schemaItems = await this.dbAll(
        'SELECT key, default_value, type FROM agent_schema',
      );

      const schema = {};
      schemaItems.forEach((item) => {
        try {
          // Parse the default value based on its type
          if (item.type === 'array') {
            schema[item.key] = { default: JSON.parse(item.default_value) };
          } else if (item.type === 'number') {
            schema[item.key] = { default: parseFloat(item.default_value) };
          } else if (item.type === 'boolean') {
            schema[item.key] = { default: item.default_value === 'true' };
          } else {
            // String or other types
            schema[item.key] = { default: item.default_value };
          }
        } catch (error) {
          logger.error(
            `Error parsing schema item ${item.key}: ${error.message}`,
          );
          schema[item.key] = { default: item.default_value }; // Fallback to string
        }
      });

      return schema;
    } catch (error) {
      logger.error(`Error retrieving agent schema: ${error.message}`);
      // Return default schema if there's an error
      return {
        subject: { default: 'test-subject' },
        name: { default: 'Erica' },
        messages: { default: [] },
      };
    }
  }

  /**
   * Clear the in-memory cache
   */
  clearCache() {
    this.stateCache.clear();
    logger.debug('SQLiteAgentMemory cache cleared');
  }

  /**
   * Close the database connection
   *
   * @async
   * @returns {Promise<void>}
   */
  async close() {
    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db.close((err) => {
          if (err) {
            logger.error(`Error closing database connection: ${err.message}`);
            reject(err);
          } else {
            logger.debug('SQLiteAgentMemory database connection closed');
            this.db = null;
            this.stateCache.clear();
            resolve();
          }
        });
      });
    }
  }
}

export default new SQLiteAgentMemory();
