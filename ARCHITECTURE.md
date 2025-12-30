# Architecture Overview

This document describes the architecture and design decisions of the Dota 2 AI Coaching Bot.

## System Architecture

```
┌─────────────────────────────────────┐
│   Dota 2 Game Client                │
│   (with -gamestateintegration)     │
└──────────────┬──────────────────────┘
               │ HTTP POST (JSON)
               ▼
┌─────────────────────────────────────┐
│   GSI Server (Express.js)           │
│   - Receives game state JSON        │
│   - Validates authentication        │
│   - Handles heartbeats              │
└──────────────┬──────────────────────┘
               │ Processed data
               ▼
┌─────────────────────────────────────┐
│   Game State Processor              │
│   - Parses raw GSI payload          │
│   - Structures data                 │
│   - Handles missing fields          │
└──────────────┬──────────────────────┘
               │ ProcessedGameState
               ▼
┌─────────────────────────────────────┐
│   Coaching Engine (Orchestrator)    │
│   ├── Net Worth Tracker (Core)      │
│   ├── Win Condition Analyzer        │
│   ├── Push Timing Detector          │
│   ├── Anti-Throw System             │
│   ├── Phase-Specific Coaching       │
│   ├── Do-Nothing Detector           │
│   ├── Confidence Calculator         │
│   └── Player Trust Calibrator       │
└──────────────┬──────────────────────┘
               │ CoachingAdvice (with confidence)
               ▼
┌─────────────────────────────────────┐
│   Message Queue                     │
│   - Priority-based rate limiting    │
│   - Confidence-based suppression    │
│   - Trust-based verbosity           │
└──────────────┬──────────────────────┘
               │ Approved messages
               ▼
┌─────────────────────────────────────┐
│   Message Formatter                 │
│   - Human-focused language          │
│   - Stress-aware formatting         │
│   - Confidence-based softening      │
└──────────────┬──────────────────────┘
               │ Formatted messages
               ▼
┌─────────────────────────────────────┐
│   Steam Bot                         │
│   - Steam authentication            │
│   - Dota 2 GC connection            │
│   - Message sending                 │
└──────────────┬──────────────────────┘
               │ API calls
               ▼
┌─────────────────────────────────────┐
│   In-Game Chat                      │
│   - Coaching messages visible       │
└─────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Post-Game Analyzer                 │
│   - Event tracking                   │
│   - Confidence-weighted analysis    │
│   - Summary generation               │
└─────────────────────────────────────┘
```

## Documentation

For detailed information on improvements and refinements:
- **[IMPROVEMENTS.md](../IMPROVEMENTS.md)** - High-impact improvements
- **[REFINEMENTS.md](../REFINEMENTS.md)** - Advanced refinements
- **[RISKS_AND_MITIGATIONS.md](../RISKS_AND_MITIGATIONS.md)** - Risk analysis
- **[PROFESSIONAL_LEVEL.md](../PROFESSIONAL_LEVEL.md)** - Professional analysis

## Core Components

### 1. GSI Server (`src/services/gsiServer.ts`)

**Responsibility**: Receive and validate game state data from Dota 2

**Key Features**:
- Express.js HTTP server
- Token-based authentication
- Heartbeat handling
- Error handling and logging

**Input**: Raw JSON from Dota 2 GSI
**Output**: Validated GSIPayload

### 2. Game State Processor (`src/services/gameStateProcessor.ts`)

**Responsibility**: Transform raw GSI data into structured format

**Key Features**:
- Type-safe data transformation
- Handles missing/optional fields
- Categorizes buildings by type
- Processes items, abilities, players

**Input**: GSIPayload
**Output**: ProcessedGameState

### 3. Win Condition Analyzer (`src/services/winConditionAnalyzer.ts`)

**Responsibility**: Identify optimal win condition based on team composition

**Key Features**:
- Scores different win conditions
- Considers enemy composition
- Calculates push timings
- Validates win condition alignment

**Win Conditions**:
- Early Push (5-15min)
- Timing Push (15-25min)
- Split Push (any time)
- Highground Siege (25-40min)
- Outscale (35min+)

### 4. Push Timing Detector (`src/services/pushTimingDetector.ts`)

**Responsibility**: Detect windows of opportunity to take objectives

**Detects**:
- Enemy hero deaths (especially cores)
- Buyback status (no buyback = game-ending window)
- Power spikes (item completions, levels)
- Ultimate advantages
- Aegis timing
- Creep wave advantages

**Output**: Array of PushWindow objects, sorted by priority

### 5. Anti-Throw System (`src/services/antiThrowSystem.ts`)

**Responsibility**: Prevent common throw scenarios

**Checks**:
- Chasing kills into fog
- Not backing after objectives
- Roshan without vision
- Buyback usage
- Over-farming with lead
- Fighting without abilities

**Output**: CoachingAdvice with HIGH/CRITICAL priority

### 6. Phase-Specific Coaching (`src/services/phaseCoaching.ts`)

**Responsibility**: Provide tailored advice for each game phase

**Phases**:
- **Laning (0-10min)**: CS targets, rune timings, level 6 spikes
- **Mid-game (10-25min)**: BKB timings, Roshan, T2 opportunities
- **Late-game (25min+)**: Ancient status, barracks, buyback windows

### 7. Coaching Engine (`src/services/coachingEngine.ts`)

**Responsibility**: Orchestrate all coaching logic

**Priority Order**:
1. Anti-throw warnings (highest)
2. Push windows
3. Phase-specific advice
4. General strategic advice

**Features**:
- Tracks game phase
- Maintains win condition analysis
- Formats messages
- Coordinates all subsystems

### 8. Confidence Calculator (`src/services/confidenceCalculator.ts`)

**Responsibility**: Calculate confidence scores for coaching advice

**Key Features**:
- Multi-dimensional confidence scoring
- Data completeness assessment
- Vision certainty calculation
- Timing precision evaluation
- Net worth reliability checking
- Language softening based on confidence
- Advice suppression for low-confidence

**Input**: ProcessedGameState, advice type, timing window
**Output**: Confidence score (0-1), factors, reasons

### 9. Net Worth Tracker (`src/services/netWorthTracker.ts`)

**Responsibility**: Track net worth deltas as core strategic signal

**Key Features**:
- Team vs enemy net worth calculation
- Delta and percentage tracking
- Trend analysis (increasing/decreasing/stable)
- Strategic recommendations based on delta
- Net worth spike detection
- Push recommendation generation

**Input**: ProcessedGameState
**Output**: NetWorthAnalysis with recommendations

### 10. Message Formatter (`src/services/messageFormatter.ts`)

**Responsibility**: Format messages with human-focused language tuning

**Key Features**:
- Stress-aware formatting
- Short sentences for high-stress situations
- Strategic capitalization
- Confidence-based language softening

**Input**: CoachingAdvice
**Output**: Formatted message string

### 11. Post-Game Analyzer (`src/services/postGameAnalyzer.ts`)

**Responsibility**: Track events and generate post-game summaries

**Key Features**:
- Event tracking (push windows, back opportunities, decisive moments)
- Confidence-weighted analysis
- Missed opportunity identification
- Recommendation generation
- Formatted summary output

**Input**: Game events, advice history
**Output**: PostGameSummary

### 12. Player Trust Calibrator (`src/services/playerTrustCalibrator.ts`)

**Responsibility**: Track compliance and adapt messaging

**Key Features**:
- Compliance tracking (5-state granular system)
- Certainty scoring for compliance
- Outcome assessment
- Trust metrics calculation
- Adaptive verbosity
- Conservative learning (noise filtering)

**Input**: CoachingAdvice, game state updates
**Output**: TrustMetrics, verbosity adjustments

### 13. Do-Nothing Detector (`src/services/doNothingDetector.ts`)

**Responsibility**: Detect when "do nothing" is optimal

**Key Features**:
- Farming phase detection
- Cooldown waiting detection
- Advantage maintenance detection
- Defensive positioning detection
- State encoding for ML labeling

**Input**: ProcessedGameState
**Output**: DoNothingState

### 14. Message Queue (`src/services/messageQueue.ts`)

**Responsibility**: Rate limit and prioritize messages

**Rate Limits**:
- GAME_ENDING: No limit
- CRITICAL: 10 seconds
- HIGH: 30 seconds
- MEDIUM: 1 minute
- LOW: 2 minutes

**Features**:
- Priority-based filtering
- Message history
- Pending message queue

### 15. Steam Bot (`src/services/steamBot.ts`)

**Responsibility**: Connect to Steam and send coaching messages

**Features**:
- Steam authentication
- Dota 2 GC connection (when available)
- Message sending
- Log-only mode fallback

**Note**: Requires compatible Dota 2 package (see README)

## Data Flow

### Game State Update Flow

1. **Dota 2** sends HTTP POST to GSI Server
2. **GSI Server** validates and receives payload
3. **Game State Processor** transforms to ProcessedGameState
4. **Coaching Engine** generates advice
5. **Message Queue** checks rate limits
6. **Steam Bot** sends message (or logs it)

### Decision Making Flow

```
Game State
    ↓
Win Condition Analysis
    ↓
Push Window Detection
    ↓
Anti-Throw Check
    ↓
Phase-Specific Advice
    ↓
Priority Assignment
    ↓
Rate Limit Check
    ↓
Message Sent
```

## Design Decisions

### Why TypeScript?

- Type safety for complex game state data
- Better IDE support and autocomplete
- Easier refactoring and maintenance
- Compile-time error detection

### Why Express.js for GSI Server?

- Simple HTTP server for GSI POST requests
- Built-in JSON parsing
- Easy to extend with middleware
- Well-documented and stable

### Why Priority-Based Rate Limiting?

- Prevents message spam
- Ensures critical messages get through
- Balances information with readability
- Respects player attention

### Why Separate Services?

- Single Responsibility Principle
- Easy to test individual components
- Can swap implementations (e.g., different Steam packages)
- Clear separation of concerns

### Why Log-Only Mode?

- Allows development without Steam setup
- Testing without game running
- Debugging and development
- No Steam account required for basic testing

## Advanced Features

### Confidence Scoring
- Every advice includes confidence score (0-1)
- Based on data completeness, vision certainty, timing precision
- Low-confidence advice suppressed by default
- Language softened based on confidence

### Trust Calibration
- Tracks player compliance with advice
- Assesses outcomes (positive/negative/neutral)
- Adapts verbosity based on behavior
- Prevents background noise for high-compliance players

### Net Worth Delta Tracking
- Core strategic signal for decision making
- Large lead (>8k) → Force objectives
- Small lead → Trade safely
- Net worth spike → Coordinate push

### Post-Game Analysis
- Confidence-weighted event tracking
- Distinguishes critical misses from low-certainty suggestions
- Provides actionable recommendations
- Tracks decisive moments

See **[IMPROVEMENTS.md](../IMPROVEMENTS.md)** and **[REFINEMENTS.md](../REFINEMENTS.md)** for detailed information.

## Extension Points

### Adding New Win Conditions

1. Add to `WIN_CONDITIONS` in `src/config/constants.ts`
2. Add scoring logic in `winConditionAnalyzer.ts`
3. Update push timing calculation

### Adding New Push Windows

1. Add detection method in `pushTimingDetector.ts`
2. Add to `detectPushWindows()` method
3. Define priority and message

### Adding Hero-Specific Logic

1. Create new service: `src/services/heroSpecificCoaching.ts`
2. Integrate into `coachingEngine.ts`
3. Add hero data to constants

### Adding Map Drawing

1. Create service: `src/services/mapDrawing.ts`
2. Use client automation (robotjs, pyautogui)
3. Integrate visual aids from CoachingAdvice

## Performance Considerations

### GSI Update Frequency

- Default: ~100-400ms (based on buffer/throttle)
- Processed asynchronously
- No blocking operations

### Memory Management

- Message history limited to 50 messages
- Game state not persisted (stateless)
- Item completion tracking uses Map (efficient)

### Rate Limiting

- Prevents message spam
- Reduces network load
- Protects against rapid state changes

## Security Considerations

### GSI Authentication

- Token-based authentication
- Prevents unauthorized access
- Configurable per installation

### Steam Credentials

- Stored in `.env` (not committed)
- Should use environment variables in production
- Consider using Steam Guard Mobile Authenticator

### No Gameplay Automation

- Read-only access to game state
- No hero control
- No input simulation (unless explicitly enabled for map drawing)
- Compliant with Valve ToS

## Testing Strategy

### Unit Tests

- Test each service independently
- Mock game state data
- Test edge cases and error handling

### Integration Tests

- Test GSI server with mock payloads
- Test coaching engine with various game states
- Test message queue rate limiting

### Manual Testing

- Run in bot matches
- Verify GSI data reception
- Check message timing and priority
- Test different game phases

## Risk Mitigation

The system includes comprehensive risk mitigation:

- **False Compliance Detection**: 5-state granular system with certainty scoring
- **Over-Silencing Protection**: Multiple override mechanisms
- **Confidence Inflation**: Independent uncertainty dimensions
- **Trust Decay Lag**: Sliding window evaluation, recalculation each session
- **User Over-Reliance**: Confidence transparency, suppressed low-confidence advice

See **[RISKS_AND_MITIGATIONS.md](../RISKS_AND_MITIGATIONS.md)** and **[THREAT_AND_FAILURE_TAXONOMY.md](../THREAT_AND_FAILURE_TAXONOMY.md)** for complete risk analysis.

## Future Enhancements

### Machine Learning

- Learn from successful games
- Predict optimal push timings
- Adapt to player skill level

### Advanced Features

- Map drawing automation
- Voice synthesis
- Post-game analysis
- Replay analysis
- Multi-game learning

### Performance

- Caching frequently accessed data
- Batch processing of game state
- Optimized data structures

## Dependencies

### Core

- `express`: GSI HTTP server
- `steam-user`: Steam authentication
- `winston`: Logging
- `dotenv`: Environment variables

### Development

- `typescript`: Type checking and compilation
- `ts-node`: Development execution
- `@types/*`: TypeScript type definitions

### Optional

- `dota2` or `node-dota2-user`: Dota 2 Game Coordinator
- `robotjs`: Client automation (for map drawing)

## Error Handling

### GSI Errors

- Invalid payloads logged and ignored
- Missing fields handled gracefully
- Connection errors retry automatically

### Steam Errors

- Authentication failures logged
- Falls back to log-only mode
- Reconnection attempts

### Coaching Errors

- Errors in advice generation logged
- System continues operating
- No advice sent on error (fail-safe)

## Logging

### Log Levels

- `error`: Critical errors
- `warn`: Warnings and fallbacks
- `info`: Important events
- `debug`: Detailed debugging

### Log Files

- `error.log`: Errors only
- `combined.log`: All logs
- Console: Formatted output

## Configuration

### Environment Variables

- `.env`: Local configuration
- `.env.example`: Template
- Not committed to repository

### Constants

- `src/config/constants.ts`: Game constants
- Win conditions, power spikes, rate limits
- Easy to modify and extend

