# LangChain/LangGraph Implementation

This directory contains the implementation of the LangChain/LangGraph-based sequential agent flow that replaces the FlowiseAI implementation defined in `TutorV0.5 Agents.json`.

## Architecture Overview

Our implementation follows the same structure as the FlowiseAI sequential agent flow:

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  START  │────>│  AGENT  │────>│ MEMORY  │────>│   END   │
└─────────┘     └─────────┘     └─────────┘     └─────────┘
    │               │               │               │
    ▼               ▼               ▼               ▼
  Setup         Process          Persist         Return
  Prompt       Message           State          Response
```

The implementation consists of four main components that directly map to the FlowiseAI nodes:

1. **START** (`seqStart_0`): Sets up the system prompt based on subject and tutor name
2. **AGENT** (`seqAgent_0`): Processes the user message through the LLM model
3. **MEMORY** (`sqliteAgentMemory_0`): Persists conversation state to SQLite
4. **END** (`seqEnd_0`): Returns the final formatted response

## Components

### 1. SQLite Agent Memory (`sqlite-memory.service.js`)

- **Purpose**: Handles state persistence and conversation history
- **Features**:
  - Database schema for storing agent state and messages
  - Checkpoint system for state management
  - In-memory caching for frequent lookups
  - Methods for saving/loading messages and state
  - Default schema management

### 2. State Manager (`state-manager.service.js`)

- **Purpose**: Manages the state schema and state transitions
- **Features**:
  - Schema definition with defaults from FlowiseAI (`subject: "test-subject"`, `name: "Erica"`)
  - State update utilities that preserve message history
  - Integration with SQLite memory for checkpointing
  - Future-proof design for LangGraph integration

### 3. Prompt Templates (`prompt-template.service.js`)

- **Purpose**: Defines specialized tutor prompts based on subject
- **Features**:
  - General tutor template with educational best practices
  - Subject-specific templates (mathematics, science, language arts, history)
  - Custom instruction support
  - LangChain-compatible interface for future integration

### 4. Agent Flow (`agent-flow.service.js`)

- **Purpose**: Implements the sequential workflow
- **Features**:
  - Node definitions that match the FlowiseAI flow
  - Sequential execution through start → agent → memory → end
  - Session-specific workflow management
  - State loading and persistence between turns
  - Comprehensive error handling

## Implementation Details

### State Schema

Our implementation uses the same state schema as defined in the FlowiseAI flow:

```javascript
{
  subject: { default: "test-subject" },
  name: { default: "Erica" },
  messages: { default: [] },
  sessionId: { default: null }
}
```

### Database Schema

The SQLite database includes the following tables:

1. **agent_memories** - Stores agent state checkpoints

   - `id`: Primary key
   - `session_id`: The session ID
   - `checkpoint_id`: Unique checkpoint identifier
   - `state_data`: JSON-serialized state
   - `created_at`: Timestamp

2. **agent_messages** - Stores conversation history

   - `id`: Primary key
   - `session_id`: The session ID
   - `message_id`: Unique message identifier
   - `role`: Message role (user, assistant, system)
   - `content`: Message content
   - `timestamp`: Timestamp

3. **agent_schema** - Stores schema definitions
   - `id`: Primary key
   - `key`: Schema key name
   - `default_value`: Default value
   - `type`: Data type (string, array, etc.)

## Usage

### Basic Usage

```javascript
import agentFlowService from './services/langchain/agent-flow.service.js';

// Create a session
const session = {
  id: 'session_123',
  subject: 'mathematics',
  name: 'Math Tutor',
};

// Process a message
const response = await agentFlowService.executeAgentFlow(
  'Can you explain what a quadratic equation is?',
  session,
  [], // Previous messages (if any)
);

// The response will contain the AI's answer and metadata
console.log(response.content); // The AI's response
console.log(response.agentState); // State metadata
```

### Test Endpoint

You can test the implementation using the `/api/tutor/test/langchain` endpoint:

```
POST /api/tutor/test/langchain
{
  "message": "Can you explain what a quadratic equation is?",
  "subject": "mathematics"
}
```

This endpoint bypasses authentication and uses a temporary session for testing.

## Configuration

The implementation is controlled via the `USE_LANGCHAIN` environment variable:

```
USE_LANGCHAIN=true
```

When set to `true`, the system will use this LangChain/LangGraph implementation instead of the direct OpenAI calls.

## Future Extensions

This implementation is designed to be easily extended to use the full LangChain/LangGraph libraries when they are installed:

1. Replace the temporary workflow with LangGraph's StateGraph
2. Update prompt templates to use LangChain's ChatPromptTemplate
3. Replace OpenAI service calls with LangChain's ChatOpenAI
