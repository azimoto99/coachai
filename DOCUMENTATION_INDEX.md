# Documentation Index

Complete guide to all documentation in the Dota 2 AI Coaching Bot project.

## Getting Started

### For Users
1. **[QUICKSTART.md](QUICKSTART.md)** - Get running in 5 minutes
2. **[SETUP.md](SETUP.md)** - Detailed setup instructions
3. **[README.md](README.md)** - Complete overview and features

### For Developers
1. **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture and design decisions
2. **[tsconfig.json](tsconfig.json)** - TypeScript configuration
3. **[package.json](package.json)** - Dependencies and scripts

---

## Core Documentation

### System Overview
- **[README.md](README.md)** - Main documentation with features, setup, and usage
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Technical architecture, data flow, design decisions

### Setup and Configuration
- **[QUICKSTART.md](QUICKSTART.md)** - 5-minute quick start guide
- **[SETUP.md](SETUP.md)** - Step-by-step setup instructions
- **[gamestate_integration_coach.cfg](gamestate_integration_coach.cfg)** - GSI configuration template

---

## Feature Documentation

### Core Improvements
- **[IMPROVEMENTS.md](IMPROVEMENTS.md)** - High-impact improvements:
  - Confidence scoring system
  - Net worth delta tracking
  - Human-focused language tuning
  - Post-game analysis

### Advanced Refinements
- **[REFINEMENTS.md](REFINEMENTS.md)** - High-leverage refinements:
  - Confidence-weighted memory
  - Player trust calibration
  - Soft "do nothing" messages

### Risk Management
- **[RISKS_AND_MITIGATIONS.md](RISKS_AND_MITIGATIONS.md)** - Subtle risks and mitigations:
  - False compliance detection
  - Over-silencing protection
  - Epistemic humility

---

## Professional Documentation

### Formal Analysis
- **[THREAT_AND_FAILURE_TAXONOMY.md](THREAT_AND_FAILURE_TAXONOMY.md)** - Formal threat and failure taxonomy:
  - Inference and modeling failures
  - Control and adaptation failures
  - Human interaction failures
  - Operational failures

- **[EXECUTIVE_JUSTIFICATION.md](EXECUTIVE_JUSTIFICATION.md)** - Executive-level justification:
  - Problem statement
  - Solution architecture
  - Risk posture
  - Appropriate use cases

### Professional Level
- **[PROFESSIONAL_LEVEL.md](PROFESSIONAL_LEVEL.md)** - Professional analysis:
  - What this system represents
  - Domain applications
  - Key differentiators
  - Next ceiling opportunities

---

## Code Documentation

### Type Definitions
- **[src/types/gameState.ts](src/types/gameState.ts)** - Game state interfaces
- **[src/types/coaching.ts](src/types/coaching.ts)** - Coaching system types
- **[src/types/steam-user.d.ts](src/types/steam-user.d.ts)** - Steam user type declarations

### Core Services
- **[src/services/gsiServer.ts](src/services/gsiServer.ts)** - Game State Integration server
- **[src/services/gameStateProcessor.ts](src/services/gameStateProcessor.ts)** - Game state processing
- **[src/services/coachingEngine.ts](src/services/coachingEngine.ts)** - Main coaching engine
- **[src/services/winConditionAnalyzer.ts](src/services/winConditionAnalyzer.ts)** - Win condition analysis
- **[src/services/pushTimingDetector.ts](src/services/pushTimingDetector.ts)** - Push window detection
- **[src/services/antiThrowSystem.ts](src/services/antiThrowSystem.ts)** - Anti-throw prevention
- **[src/services/phaseCoaching.ts](src/services/phaseCoaching.ts)** - Phase-specific coaching

### Advanced Services
- **[src/services/confidenceCalculator.ts](src/services/confidenceCalculator.ts)** - Confidence scoring
- **[src/services/netWorthTracker.ts](src/services/netWorthTracker.ts)** - Net worth analysis
- **[src/services/messageFormatter.ts](src/services/messageFormatter.ts)** - Message formatting
- **[src/services/postGameAnalyzer.ts](src/services/postGameAnalyzer.ts)** - Post-game analysis
- **[src/services/playerTrustCalibrator.ts](src/services/playerTrustCalibrator.ts)** - Trust calibration
- **[src/services/doNothingDetector.ts](src/services/doNothingDetector.ts)** - Do-nothing detection

### Utilities
- **[src/utils/logger.ts](src/utils/logger.ts)** - Logging utility
- **[src/config/constants.ts](src/config/constants.ts)** - System constants

---

## Documentation by Audience

### End Users
1. Start with: **[QUICKSTART.md](QUICKSTART.md)**
2. Reference: **[README.md](README.md)** for features
3. Troubleshooting: **[SETUP.md](SETUP.md)** troubleshooting section

### Developers
1. Start with: **[ARCHITECTURE.md](ARCHITECTURE.md)**
2. Review: **[IMPROVEMENTS.md](IMPROVEMENTS.md)** and **[REFINEMENTS.md](REFINEMENTS.md)**
3. Understand risks: **[RISKS_AND_MITIGATIONS.md](RISKS_AND_MITIGATIONS.md)**

### Architects / Auditors
1. Start with: **[EXECUTIVE_JUSTIFICATION.md](EXECUTIVE_JUSTIFICATION.md)**
2. Review: **[THREAT_AND_FAILURE_TAXONOMY.md](THREAT_AND_FAILURE_TAXONOMY.md)**
3. Understand level: **[PROFESSIONAL_LEVEL.md](PROFESSIONAL_LEVEL.md)**

### Product Managers
1. Start with: **[EXECUTIVE_JUSTIFICATION.md](EXECUTIVE_JUSTIFICATION.md)**
2. Review: **[README.md](README.md)** for features
3. Understand risks: **[RISKS_AND_MITIGATIONS.md](RISKS_AND_MITIGATIONS.md)**

---

## Documentation Roadmap

### Completed ✅
- [x] User setup guides
- [x] Architecture documentation
- [x] Feature documentation
- [x] Risk analysis
- [x] Professional analysis
- [x] Formal threat taxonomy
- [x] Executive justification

### Future Enhancements ⏳
- [ ] API documentation (if exposed)
- [ ] Performance benchmarks
- [ ] Deployment guides
- [ ] Monitoring and observability
- [ ] Contributing guidelines

---

## Quick Reference

### Key Concepts
- **Confidence Scoring**: Every advice has 0-1 confidence score
- **Trust Calibration**: System adapts to player behavior
- **Conservative Learning**: Requires consistent, high-certainty evidence
- **Multiple Safeguards**: Override mechanisms prevent critical failures

### Key Files
- **Entry Point**: `src/index.ts`
- **Main Engine**: `src/services/coachingEngine.ts`
- **Configuration**: `src/config/constants.ts`
- **GSI Config**: `gamestate_integration_coach.cfg`

### Key Commands
```bash
npm install          # Install dependencies
npm run build        # Build TypeScript
npm start            # Run the coach
npm run dev          # Development mode
```

---

## Document Maintenance

- **Last Updated**: 2024
- **Review Cycle**: Quarterly
- **Owner**: System Architect
- **Contributors**: See git history

For questions or updates, refer to the main README or open an issue.

