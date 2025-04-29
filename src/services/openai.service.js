/**
 * @module OpenAIService
 * @description Service to handle interactions with OpenAI API
 */

import config from '../config/config.js';
import logger from '../utils/logger.js';

class OpenAIService {
  /**
   * Process a user message and generate a tutor response based on the chat history
   * and tutor session context
   *
   * @async
   * @param {string} userMessage - The user's message
   * @param {Object} session - The tutor session object
   * @param {Array} messageHistory - Previous messages in the conversation
   * @returns {Promise<string>} - The assistant's response
   */
  async generateTutorResponse(userMessage, session, messageHistory) {
    try {
      if (!config.openAI.apiKey) {
        logger.warn('OpenAI API key not configured, using fallback response');
        return this.generateFallbackResponse(userMessage, session.subject);
      }

      // Prepare messages for the OpenAI API call
      const messages = [
        {
          role: 'system',
          content: `You are a friendly and knowledgeable tutor specializing in ${
            session.subject || 'various subjects'
          }. 
                   Your goal is to help the user understand concepts clearly and answer their questions thoroughly.
                   Provide explanations that are accurate, helpful, and tailored to the user's level of understanding.`,
        },
      ];

      // Add message history
      if (messageHistory && messageHistory.length > 0) {
        // Filter out system messages for the API call
        const apiMessages = messageHistory
          .filter((msg) => msg.role !== 'system')
          .map((msg) => ({
            role: msg.role,
            content: msg.content,
          }));

        messages.push(...apiMessages);
      }

      // Add the current user message
      messages.push({
        role: 'user',
        content: userMessage,
      });

      // Log request to aid debugging (without sensitive data)
      logger.debug(
        `Sending request to OpenAI API with ${messages.length} messages`,
      );

      // Call OpenAI API
      const response = await fetch(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.openAI.apiKey}`,
          },
          body: JSON.stringify({
            model: config.openAI.defaultModel,
            messages: messages,
            temperature: 0.7,
            max_tokens: 1000,
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        logger.error(`OpenAI API error: ${JSON.stringify(error)}`);
        return this.generateFallbackResponse(userMessage, session.subject);
      }

      const data = await response.json();

      // Log successful API call
      logger.info(
        `Received response from OpenAI API for session ${session.id}`,
      );

      return data.choices[0].message.content;
    } catch (error) {
      logger.error(`Error generating tutor response: ${error.message}`);
      logger.debug(error.stack);
      return this.generateFallbackResponse(userMessage, session.subject);
    }
  }

  /**
   * Generate a fallback response when the OpenAI API is not available
   *
   * @param {string} userMessage - The user's message
   * @param {string} subject - The subject of the tutor session
   * @returns {string} - A fallback response
   */
  generateFallbackResponse(userMessage, subject) {
    const fallbackResponses = [
      `I understand you're asking about "${userMessage}". As your tutor for ${
        subject || 'this subject'
      }, I'd normally provide a detailed explanation. However, I'm currently experiencing connection issues. Could you please try again in a moment?`,

      `That's an interesting question about ${
        subject || 'this topic'
      }. I'd like to give you a comprehensive answer, but I'm having trouble accessing my resources right now. Could we revisit this shortly?`,

      `Thank you for your question on ${
        subject || 'this subject'
      }. I'm currently unable to provide a full response due to technical limitations. Please try again soon for a complete answer.`,
    ];

    // Select a random fallback response
    return fallbackResponses[
      Math.floor(Math.random() * fallbackResponses.length)
    ];
  }
}

export default new OpenAIService();
