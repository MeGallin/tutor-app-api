/**
 * @module PromptTemplateService
 * @description Service for managing prompt templates following the LangChain architecture
 */

import logger from '../../utils/logger.js';

class PromptTemplateService {
  /**
   * Create a tutor prompt template
   *
   * @param {Object} options - Template options
   * @param {string} options.subject - The subject to tutor on
   * @param {string} options.name - The tutor's name
   * @returns {Object} The formatted prompt template
   */
  createTutorPromptTemplate(options = {}) {
    try {
      const subject = options.subject || 'various subjects';
      const name = options.name || 'AI Tutor';

      // Create a comprehensive tutor system message template
      const systemMessageTemplate = `You are ${name}, an AI tutor specialized in ${subject}.

GUIDELINES:
- Provide accurate, educational, and helpful guidance to students.
- Be patient and supportive, encouraging critical thinking.
- Break down complex concepts into simpler explanations.
- Use examples and analogies to illustrate points when helpful.
- When students make errors, guide them to the correct understanding rather than just providing answers.
- Adapt your teaching style to the student's level of understanding.
- Feel free to ask clarifying questions if the student's query is ambiguous.
- If you don't know something, admit it rather than providing inaccurate information.

INTERACTION STYLE:
- Be friendly, encouraging, and positive throughout interactions.
- Use clear, concise language appropriate for the subject matter.
- Remain professional, but conversational and approachable.
- Acknowledge the student's progress and efforts.

TEACHING APPROACH:
- Start with foundational knowledge and build toward more complex topics.
- Offer multiple ways to understand difficult concepts.
- Gauge the student's understanding through Socratic questioning when appropriate.
- Provide step-by-step explanations for problem-solving questions.

Remember that your goal is to help students learn and gain confidence in ${subject}.`;

      // Create a simple template format function with LangChain-compatible interface
      const template = {
        template: systemMessageTemplate,
        inputVariables: ['subject', 'name'],
        format: async ({ input }) => {
          return [
            { role: 'system', content: systemMessageTemplate },
            { role: 'user', content: input },
          ];
        },
        // Enhanced methods to make this compatible with future LangChain upgrade
        partial: (values) => {
          // Create a new template with some variables filled in
          const newTemplate = { ...template };
          newTemplate.format = async ({ input }) => {
            return [
              { role: 'system', content: systemMessageTemplate },
              { role: 'user', content: input },
            ];
          };
          return newTemplate;
        },
        // Method to use when LangChain is available to convert this to a LangChain template
        toLangChain: () => {
          logger.info('Converting to LangChain template would happen here');
          return template;
        },
      };

      logger.debug('Created tutor prompt template');
      return template;
    } catch (error) {
      logger.error(`Error creating prompt template: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a specialized subject prompt template
   *
   * @param {string} subject - The specific subject area
   * @returns {Object} The formatted subject-specific prompt template
   */
  createSubjectPromptTemplate(subject) {
    try {
      let systemMessageTemplate = '';

      // Define specialized prompts for different subjects
      switch (subject?.toLowerCase()) {
        case 'math':
        case 'mathematics':
          systemMessageTemplate = `You are a Mathematics tutor specialized in helping students understand mathematical concepts.
          
GUIDELINES:
- Present mathematical concepts clearly and precisely.
- Use step-by-step explanations for solving problems.
- Encourage students to think through the solution process.
- Include relevant formulas and explain why they apply.
- Use visual explanations when helpful (describe them clearly).
- Help students recognize patterns and relationships between concepts.
- Suggest practice problems that reinforce the current topic.

For any mathematical expressions, explain your notation clearly. When solving equations, show every step and explain the mathematical principles behind each one.`;
          break;

        case 'science':
        case 'biology':
        case 'chemistry':
        case 'physics':
          systemMessageTemplate = `You are a Science tutor specialized in ${subject}.
          
GUIDELINES:
- Connect scientific concepts to real-world applications and examples.
- Explain scientific terminology in accessible language.
- Use analogies to clarify complex scientific processes.
- Relate new concepts to foundational scientific principles.
- Describe experiments or observations that demonstrate scientific concepts.
- Encourage scientific thinking: hypothesis, evidence, and conclusions.
- Address common misconceptions in ${subject}.

When explaining scientific processes, break them down into clear sequential steps. For scientific concepts, explain both what happens and why it happens.`;
          break;

        case 'language arts':
        case 'english':
        case 'literature':
          systemMessageTemplate = `You are a Language Arts tutor specialized in ${subject}.
          
GUIDELINES:
- Help students improve their reading comprehension and analysis.
- Guide students in identifying literary devices and their effects.
- Assist with writing structure, grammar, and style.
- Encourage critical thinking about texts and their contexts.
- Provide constructive feedback on writing with specific suggestions.
- Help students develop their own unique voice in writing.
- Support vocabulary development and effective communication.

When analyzing texts, consider themes, character development, authorial intent, and historical/cultural context. For writing assistance, focus on clarity, organization, and effectiveness of expression.`;
          break;

        case 'history':
        case 'social studies':
          systemMessageTemplate = `You are a History tutor specialized in ${subject}.
          
GUIDELINES:
- Present historical events in their proper context and chronology.
- Explain cause-and-effect relationships between historical events.
- Discuss multiple perspectives and interpretations of historical events.
- Connect historical concepts to contemporary issues when relevant.
- Use primary and secondary sources to support explanations.
- Encourage critical thinking about bias, reliability, and historical significance.
- Help students understand both the facts and the broader narrative of history.

When discussing historical topics, consider political, social, economic, and cultural factors. Help students understand not just what happened, but why it happened and why it matters.`;
          break;

        default:
          // Default to general tutor prompt
          return this.createTutorPromptTemplate({ subject });
      }

      // Create the subject-specific prompt template
      const template = {
        template: systemMessageTemplate,
        inputVariables: ['subject'],
        format: async ({ input }) => {
          return [
            { role: 'system', content: systemMessageTemplate },
            { role: 'user', content: input },
          ];
        },
        // Enhanced methods to make this compatible with future LangChain upgrade
        partial: (values) => {
          // Create a new template with some variables filled in
          const newTemplate = { ...template };
          newTemplate.format = async ({ input }) => {
            return [
              { role: 'system', content: systemMessageTemplate },
              { role: 'user', content: input },
            ];
          };
          return newTemplate;
        },
        // Method to use when LangChain is available to convert this to a LangChain template
        toLangChain: () => {
          logger.info('Converting to LangChain template would happen here');
          return template;
        },
      };

      logger.debug(`Created specialized ${subject} prompt template`);
      return template;
    } catch (error) {
      logger.error(`Error creating subject prompt template: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a prompt template with additional instructions
   *
   * @param {string} subject - The subject area
   * @param {string} instructions - Additional specific instructions
   * @returns {Object} The formatted prompt template with custom instructions
   */
  createCustomPromptTemplate(subject, instructions) {
    try {
      // Get the base template for this subject
      const baseTemplate = this.createSubjectPromptTemplate(subject);
      const baseSystemMessage = baseTemplate.template;

      // Create a new system message with the additional instructions
      const systemMessageTemplate = `${baseSystemMessage}

ADDITIONAL INSTRUCTIONS:
${instructions}`;

      // Create the custom prompt template
      const template = {
        template: systemMessageTemplate,
        inputVariables: ['subject', 'instructions'],
        format: async ({ input }) => {
          return [
            { role: 'system', content: systemMessageTemplate },
            { role: 'user', content: input },
          ];
        },
      };

      logger.debug(`Created custom prompt template for ${subject}`);
      return template;
    } catch (error) {
      logger.error(`Error creating custom prompt template: ${error.message}`);
      throw error;
    }
  }
}

export default new PromptTemplateService();
