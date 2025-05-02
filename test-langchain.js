/**
 * LangChain Implementation Test Script
 * 
 * This script tests the LangChain/LangGraph implementation by simulating
 * different session scenarios and subjects.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Set up dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// Force enable LangChain for testing
process.env.USE_LANGCHAIN = 'true';

// Import required modules
import logger from './src/utils/logger.js';
import agentFlowService from './src/services/langchain/agent-flow.service.js';
import sqliteMemoryService from './src/services/langchain/sqlite-memory.service.js';
import tutorAgentService from './src/services/tutor-agent.service.js';

// Configure logger to output to console for testing
logger.transports.forEach(t => {
  t.silent = false;
  if (t.name === 'console') {
    t.level = 'debug';
  }
});

// Test subjects
const subjects = [
  'mathematics', 
  'biology', 
  'history', 
  'physics', 
  'literature'
];

/**
 * Run a test for a specific subject
 */
async function testSubject(subject) {
  console.log(`\n\n======= TESTING ${subject.toUpperCase()} =======\n`);
  
  // Create a session
  const sessionId = `test_${Date.now()}_${subject}`;
  const session = {
    id: sessionId,
    subject: subject,
    name: `${subject.charAt(0).toUpperCase() + subject.slice(1)} Tutor`
  };
  
  // Test questions based on subject
  let question = '';
  switch(subject) {
    case 'mathematics':
      question = "What is the Pythagorean theorem and how is it applied?";
      break;
    case 'biology':
      question = "Can you explain the process of cellular respiration?";
      break;
    case 'history':
      question = "What were the main causes of World War I?";
      break;
    case 'physics':
      question = "Explain Newton's three laws of motion.";
      break;
    case 'literature':
      question = "What are the key themes in Shakespeare's Hamlet?";
      break;
    default:
      question = "What is the most interesting fact about this subject?";
  }
  
  console.log(`Question: ${question}`);
  console.log(`Processing using both direct AgentFlowService and TutorAgentService facade...`);
  
  try {
    // Test direct agentFlowService
    console.log("\n--- Testing direct agentFlowService ---");
    const directResponse = await agentFlowService.executeAgentFlow(
      question,
      session,
      []
    );
    
    console.log("\nResponse:", directResponse.content.substring(0, 150) + "...");
    console.log("State metadata:", JSON.stringify(directResponse.agentState, null, 2));
    
    // Test through tutorAgentService facade
    console.log("\n--- Testing through tutorAgentService facade ---");
    const facadeResponse = await tutorAgentService.processMessage(
      question,
      session,
      []
    );
    
    console.log("\nResponse:", facadeResponse.content.substring(0, 150) + "...");
    console.log("Metadata:", JSON.stringify(facadeResponse.metadata, null, 2));
    
    // Verify the response contains subject-specific information
    if (facadeResponse.content.toLowerCase().includes(subject.toLowerCase())) {
      console.log(`\n✅ Response contains subject-specific information for ${subject}`);
    } else {
      console.log(`\n⚠️ Response may not contain subject-specific information for ${subject}`);
    }
    
    // Verify checkpoints were created in SQLite
    const checkpointId = directResponse.agentState.checkpointId;
    if (checkpointId) {
      const checkpoint = await sqliteMemoryService.loadCheckpoint(sessionId, checkpointId);
      console.log(`\n✅ Successfully retrieved checkpoint from SQLite: ${checkpointId}`);
      
      if (checkpoint?.subject === subject) {
        console.log(`✅ Checkpoint contains correct subject: ${checkpoint.subject}`);
      } else {
        console.log(`⚠️ Checkpoint subject mismatch: expected ${subject}, got ${checkpoint?.subject}`);
      }
    } else {
      console.log(`\n⚠️ No checkpoint ID found in response`);
    }
    
    // Simulate a follow-up question
    console.log("\n--- Testing follow-up question ---");
    const followUpQuestion = `Can you provide an example related to ${subject}?`;
    console.log(`Follow-up question: ${followUpQuestion}`);
    
    const followUpResponse = await agentFlowService.executeAgentFlow(
      followUpQuestion,
      session,
      [
        { role: 'user', content: question },
        { role: 'assistant', content: directResponse.content }
      ]
    );
    
    console.log("\nFollow-up response:", followUpResponse.content.substring(0, 150) + "...");
    
    // Clean up
    console.log("\nCleaning up session resources...");
    await tutorAgentService.endSession(sessionId);
    
    console.log(`\n✅ Test for ${subject} completed successfully\n`);
    return { subject, success: true };
    
  } catch (error) {
    console.error(`\n❌ Test for ${subject} failed:`, error);
    return { subject, success: false, error: error.message };
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log("===========================================");
  console.log("Starting LangChain Implementation Test Suite");
  console.log("===========================================\n");
  
  console.log("Testing environment configuration...");
  console.log(`USE_LANGCHAIN is set to: ${process.env.USE_LANGCHAIN}`);
  
  // Initialize SQLite memory service
  await sqliteMemoryService.initialize();
  console.log("✅ SQLite memory service initialized successfully\n");
  
  // Test each subject
  const results = [];
  for (const subject of subjects) {
    try {
      const result = await testSubject(subject);
      results.push(result);
    } catch (error) {
      console.error(`Error running test for ${subject}:`, error);
      results.push({ subject, success: false, error: error.message });
    }
  }
  
  // Print summary
  console.log("\n===========================================");
  console.log("Test Results Summary");
  console.log("===========================================\n");
  
  let successCount = 0;
  results.forEach(result => {
    if (result.success) {
      successCount++;
      console.log(`✅ ${result.subject}: Success`);
    } else {
      console.log(`❌ ${result.subject}: Failed - ${result.error || 'Unknown error'}`);
    }
  });
  
  console.log(`\nTotal: ${results.length}, Succeeded: ${successCount}, Failed: ${results.length - successCount}`);
  
  // Close SQLite connection
  await sqliteMemoryService.close();
  console.log("\n✅ SQLite memory service connection closed");
  
  console.log("\n===========================================");
  console.log("Test Suite Complete");
  console.log("===========================================");
  
  // Exit the process
  process.exit(successCount === results.length ? 0 : 1);
}

// Run tests
runTests().catch(error => {
  console.error("Test runner failed:", error);
  process.exit(1);
});