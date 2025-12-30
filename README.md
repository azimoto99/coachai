# Dota 2 AI Coaching Bot

An AI-powered coaching bot for Dota 2 that focuses on one goal: **helping you destroy the enemy Ancient as fast as possible**.

## Core Philosophy

Every piece of advice answers: **"Does this action get us closer to destroying the Ancient faster?"**

- Prioritizes objectives over kills
- Identifies and executes on the fastest win condition
- Recognizes power spikes and push timings
- Punishes enemy mistakes that create Ancient-taking opportunities

## Features

### Core Features
- ✅ Real-time game state analysis via Game State Integration (GSI)
- ✅ Win condition identification based on team composition
- ✅ Power spike detection (items, levels, timings)
- ✅ Push window analysis (enemy deaths, buybacks, Aegis)
- ✅ Anti-throw prevention system
- ✅ Phase-specific coaching (laning, mid-game, late-game)
- ✅ Priority-based message queue with rate limiting
- ✅ Steam bot integration for in-game coaching

### Advanced Features
- ✅ **Confidence Scoring**: Every advice includes confidence score (0-1) with reasons
- ✅ **Net Worth Delta Tracking**: Core strategic signal for decision making
- ✅ **Human-Focused Language**: Stress-aware messaging optimized for clarity
- ✅ **Post-Game Analysis**: Comprehensive analysis with missed opportunities and recommendations
- ✅ **Player Trust Calibration**: Adapts verbosity based on compliance and outcomes
- ✅ **Confidence-Weighted Memory**: Post-game analysis distinguishes critical misses from low-certainty suggestions
- ✅ **Do-Nothing Detection**: Encodes intentional silence as valid state
- ✅ **Conservative Learning**: Prevents overlearning from noisy signals

## Prerequisites

- Node.js v14 or higher
- Dota 2 installed via Steam
- A Steam account for the coaching bot (can be a separate account)
- Basic understanding of Dota 2 mechanics

## Installation

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd coachai
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```env
STEAM_USERNAME=your_bot_steam_username
STEAM_PASSWORD=your_bot_steam_password
GSI_PORT=3000
GSI_TOKEN=your_secure_token_here
COACH_AGGRESSIVENESS=0.8
COACH_VOICE_ALERTS=true
COACH_MAP_DRAWING=false
LOG_LEVEL=info
```

### 3. Set Up Dota 2 Game State Integration

#### Step 1: Add Launch Options

1. Open Steam
2. Right-click Dota 2 → Properties → General → Launch Options
3. Add: `-gamestateintegration -console`

#### Step 2: Create GSI Configuration File

**Windows:**
```
C:\Program Files (x86)\Steam\steamapps\common\dota 2 beta\game\dota\cfg\gamestate_integration\gamestate_integration_coach.cfg
```

**Linux:**
```
~/.steam/steam/steamapps/common/dota 2 beta/game/dota/cfg/gamestate_integration/gamestate_integration_coach.cfg
```

**Mac:**
```
~/Library/Application Support/Steam/steamapps/common/dota 2 beta/game/dota/cfg/gamestate_integration/gamestate_integration_coach.cfg
```

Copy the contents of `gamestate_integration_coach.cfg` from this repository into the file above.

**Important:** Update the `token` field in the config file to match your `GSI_TOKEN` in `.env`.

### 4. Build the Project

```bash
npm run build
```

## Usage

### Starting the Coach

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

### In-Game Setup

1. Start the coaching bot (see above)
2. Launch Dota 2
3. The bot will automatically receive game state data via GSI
4. Invite the bot Steam account as a coach in your game lobby
5. The bot will provide real-time coaching advice

### Log-Only Mode

If you don't set up Steam bot credentials, the coach will run in log-only mode, printing all coaching advice to the console. This is useful for testing and development.

## How It Works

### Architecture

```
Dota 2 Client (with GSI)
    ↓ HTTP POST
GSI Server (Node.js)
    ↓ Processed Data
Game State Processor
    ↓ ProcessedGameState
Coaching Engine
    ├── Win Condition Analyzer
    ├── Push Timing Detector
    ├── Net Worth Tracker (Core Signal)
    ├── Anti-Throw System
    ├── Phase-Specific Coaching
    ├── Confidence Calculator
    ├── Do-Nothing Detector
    └── Player Trust Calibrator
    ↓ Coaching Advice (with confidence)
Message Queue (Priority-based Rate Limiting)
    ↓
Message Formatter (Human-focused)
    ↓
Steam Bot → Dota 2 Game Coordinator
    ↓
In-Game Chat Messages
    ↓
Post-Game Analyzer (Event Tracking)
```

### Coaching Logic Flow

1. **Game State Analysis**: GSI provides real-time game data
2. **Net Worth Analysis**: Calculates team vs enemy net worth delta (core signal)
3. **Win Condition Identification**: Analyzes team composition to determine optimal strategy
4. **Push Window Detection**: Identifies opportunities to take objectives
5. **Anti-Throw Prevention**: Warns against common throw scenarios
6. **Confidence Calculation**: Scores advice based on data completeness, vision certainty, timing precision
7. **Trust Calibration Check**: Adjusts verbosity based on player compliance history
8. **Message Formatting**: Applies human-focused, stress-aware language
9. **Message Prioritization**: Critical messages bypass rate limits, low-confidence advice suppressed
10. **Post-Game Tracking**: Records events for analysis and learning

### Win Conditions

The bot identifies and adapts to different win conditions:

- **Early Push**: Group early, take towers before enemy cores come online
- **Timing Push**: Push when BKB/key items complete, force highground
- **Split Push**: Create map pressure, force rotations, hit buildings
- **Highground Siege**: Starve enemy, siege slowly with superior range
- **Outscale**: Delay game, defend highground, farm to 6-slot

### Push Windows Detected

- Enemy hero deaths (especially cores without buyback)
- Power spikes (item completions, level 6, BKB timing)
- Ultimate advantages
- Aegis timing
- Creep wave advantages
- Low tower health

### Anti-Throw Prevention

The bot warns against:
- Chasing kills into fog instead of taking objectives
- Not backing after taking objectives
- Attempting Roshan without vision
- Using buyback unnecessarily
- Over-farming when team has huge lead
- Fighting without key abilities ready

## Configuration

### Coaching Aggressiveness

Set `COACH_AGGRESSIVENESS` in `.env` (0-1 scale):
- `0.5`: Conservative, fewer messages
- `0.8`: Balanced (default)
- `1.0`: Aggressive, maximum guidance

### Message Priorities

Messages are prioritized and rate-limited:

- **GAME_ENDING**: No rate limit (e.g., "Enemy core no buyback - END NOW")
- **CRITICAL**: 10 seconds between messages
- **HIGH**: 30 seconds between messages
- **MEDIUM**: 1 minute between messages
- **LOW**: 2 minutes between messages

## Development

### Project Structure

```
coachai/
├── src/
│   ├── types/           # TypeScript interfaces
│   ├── services/        # Core services
│   │   ├── gsiServer.ts
│   │   ├── gameStateProcessor.ts
│   │   ├── winConditionAnalyzer.ts
│   │   ├── pushTimingDetector.ts
│   │   ├── netWorthTracker.ts
│   │   ├── antiThrowSystem.ts
│   │   ├── coachingEngine.ts
│   │   ├── phaseCoaching.ts
│   │   ├── confidenceCalculator.ts
│   │   ├── messageFormatter.ts
│   │   ├── postGameAnalyzer.ts
│   │   ├── playerTrustCalibrator.ts
│   │   ├── doNothingDetector.ts
│   │   ├── messageQueue.ts
│   │   └── steamBot.ts
│   ├── config/          # Configuration constants
│   ├── utils/           # Utilities
│   └── index.ts         # Main entry point
├── docs/                # Documentation (see Documentation section)
├── gamestate_integration_coach.cfg
├── package.json
├── tsconfig.json
└── README.md
```

### Building

```bash
npm run build
```

### Type Checking

```bash
npx tsc --noEmit
```

### Testing

The project includes a mock mode for testing without a live game. See `src/services/steamBot.ts` for details.

## Limitations & Notes

### GSI Limitations

- Data is limited to what your team can see (no fog of war cheating)
- Player data only available for local player when playing
- Full data available when spectating
- Updates sent based on `buffer` and `throttle` settings (~100-400ms delays typical)

### Steam Bot Integration

The Steam bot integration requires a compatible Dota 2 package. Current options:

- `dota2` (may be deprecated) - included in package.json but may need alternative
- `node-dota2-user` (community fork) - recommended alternative
- Custom implementation using Steam Web API

**Note**: The `dota2` package in package.json may be outdated. If you encounter issues:

1. Try installing `node-dota2-user` instead:
   ```bash
   npm uninstall dota2
   npm install node-dota2-user
   ```

2. Update `src/services/steamBot.ts` to use the alternative package

3. Or run in log-only mode (no Steam bot needed) for development

See `src/services/steamBot.ts` for implementation details.

### Valve ToS Compliance

This bot:
- ✅ Uses read-only access to game state via official GSI
- ✅ Does not automate gameplay (doesn't control hero)
- ✅ Does not manipulate fog of war (sees only team vision)
- ✅ Uses official coaching feature as intended
- ✅ Similar to existing tools like Dota Coach

## Troubleshooting

### GSI Not Receiving Data

1. Check that launch options are set correctly
2. Verify GSI config file is in correct location
3. Ensure GSI server is running and accessible on the configured port
4. Check firewall settings
5. Verify token matches in both `.env` and GSI config

### Steam Bot Not Connecting

1. Verify Steam credentials are correct
2. Check for Steam Guard requirements
3. Ensure bot account owns Dota 2
4. Check network connectivity
5. Review logs for specific error messages

### No Coaching Messages

1. Verify game is in progress (not in menu)
2. Check that GSI is receiving data (check logs)
3. Ensure message queue isn't rate-limiting everything
4. Verify coaching engine is generating advice (check logs)

## Example Coaching Scenarios

### Scenario 1: Early BKB Timing Push (15 minutes)

```
12:00 - "Farm BKB - 800 gold away. Hit jungle camps until complete."
14:30 - "BKB in 30 seconds - Start moving toward mid lane"
15:00 - "BKB DONE. Group mid NOW. This is our timing window."
15:30 - "Take T2 and back, don't go high ground yet"
16:00 - "Good push. Back to base, next timing at Aegis (minute 20)"
```

### Scenario 2: Game-Ending Window (35 minutes)

```
35:00 - "Enemy carry dead 70 seconds - NO BUYBACK"
35:02 - "THIS IS IT - Group bot lane and hit Ancient"
35:10 - "Kill these first" [referring to blocking heroes]
35:30 - "45 seconds until respawn - Commit EVERYTHING or we lose window"
```

### Scenario 3: Split Push Opportunity (28 minutes)

```
28:00 - "Enemy all top - You split push bot as NP"
28:20 - "Enemy rotating - TP out in 3 seconds"
28:30 - "Good trade - got T2+T3 bot for free. Their team wasted 30 seconds"
```

## Documentation

Comprehensive documentation is available:

### Getting Started
- **[QUICKSTART.md](QUICKSTART.md)** - Get running in 5 minutes
- **[SETUP.md](SETUP.md)** - Detailed setup instructions
- **[DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)** - Complete documentation guide

### Technical Documentation
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture and design
- **[IMPROVEMENTS.md](IMPROVEMENTS.md)** - High-impact improvements
- **[REFINEMENTS.md](REFINEMENTS.md)** - Advanced refinements

### Professional Documentation
- **[PROFESSIONAL_LEVEL.md](PROFESSIONAL_LEVEL.md)** - Professional analysis
- **[RISKS_AND_MITIGATIONS.md](RISKS_AND_MITIGATIONS.md)** - Risk analysis
- **[THREAT_AND_FAILURE_TAXONOMY.md](THREAT_AND_FAILURE_TAXONOMY.md)** - Formal threat taxonomy
- **[EXECUTIVE_JUSTIFICATION.md](EXECUTIVE_JUSTIFICATION.md)** - Executive-level justification

## Contributing

Contributions are welcome! Areas for improvement:

- Enhanced hero-specific coaching
- Better team composition analysis
- Map drawing automation
- Voice synthesis for critical alerts
- Machine learning for timing predictions
- Expected Value Modeling
- Counterfactual Tracking
- Advanced Meta-Learning

## License

MIT

## Disclaimer

This bot is for educational and coaching purposes only. Use at your own risk. Ensure compliance with Valve's Terms of Service.

## Key Differentiators

This system goes beyond basic game AI:

- **Confidence-Weighted Decisions**: Not binary "say" or "don't say" - quantifies uncertainty
- **Trust Calibration**: Learns player behavior and adapts, preventing background noise
- **Epistemic Humility**: Acknowledges limitations, suppresses low-confidence advice
- **Conservative Learning**: Prevents overlearning from noisy signals
- **Production-Grade**: Real-time systems, decision theory, human factors engineering

See **[PROFESSIONAL_LEVEL.md](PROFESSIONAL_LEVEL.md)** for detailed analysis.

## Support

For issues, questions, or contributions, please open an issue on the repository.

---

**Remember**: The goal is to destroy the Ancient. Every decision should move toward that objective.

**System Philosophy**: This is a decision-support system, not decision automation. It provides calibrated, confidence-weighted recommendations while explicitly acknowledging uncertainty. See **[EXECUTIVE_JUSTIFICATION.md](EXECUTIVE_JUSTIFICATION.md)** for details.

