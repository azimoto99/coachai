# High-Leverage Refinements

This document describes the high-leverage refinements that build directly on the core improvements, creating leverage multipliers for the coaching system.

## 1. Confidence-Weighted Memory ✅

### Implementation

**Enhanced**: `src/services/postGameAnalyzer.ts`

Post-game analysis now weights missed opportunities by:
- **Confidence at the time** (0-1 scale)
- **Net worth context** (delta and percentage)

### Features

1. **Event Weighting**
   - Each event gets a `weight` (0-1) based on confidence and net worth context
   - High confidence (>0.7) + large net worth delta (>20%) = higher weight
   - Events sorted by weight in post-game summary

2. **Confidence-Weighted Analysis**
   - Tracks high-confidence missed opportunities separately
   - Distinguishes between critical misses and low-certainty suggestions
   - Provides psychological and pedagogical value

3. **Enhanced Recommendations**

   **Before:**
   ```
   "Missed 3 push window(s) - Review timing and decision making"
   ```

   **After:**
   ```
   "You missed 2 high-confidence game-ending window(s) - These were critical opportunities"
   "You missed 1 low-certainty suggestion(s) - These were less critical"
   ```

### Example Output

```
MISSED PUSH WINDOWS:
  - 15:30 - Push window: hero_deaths [Confidence: 85%] [Weight: 92%]
    Advice: 2 enemies dead - PUSH NOW
  - 28:45 - Push window: no_buyback [Confidence: 95%] [Weight: 98%]
    Advice: Enemy core NO BUYBACK - This is THE window to end

CONFIDENCE-WEIGHTED ANALYSIS:
  High-confidence missed: 2
  Low-confidence missed: 1
  High-confidence taken: 5
  Average confidence: 78.5%
```

### Impact

- **Psychological**: Players understand which misses were truly critical
- **Pedagogical**: Focus learning on high-confidence opportunities
- **Trust**: Transparent about uncertainty levels

---

## 2. Player Trust Calibration ✅

### Implementation

**New Service**: `src/services/playerTrustCalibrator.ts`

Tracks player compliance and adapts messaging dynamically.

### Features

1. **Compliance Tracking**
   - Records every piece of advice given
   - Detects if advice was followed by analyzing subsequent game state
   - Tracks time to comply (response time)
   - Assesses outcomes (positive/negative/neutral)

2. **Trust Metrics**
   - **Compliance Rate**: How often advice is followed (0-1)
   - **Positive Outcome Rate**: How often following advice leads to positive outcomes
   - **Average Response Time**: Time between advice and action
   - **Verbosity Level**: Current messaging verbosity (high/medium/low)
   - **Explanation Level**: Current explanation depth (detailed/standard/minimal)

3. **Adaptive Behavior**

   **High Compliance (>70%)**
   - Reduces verbosity (fewer messages)
   - Minimal explanations
   - Trusts player to make decisions
   - Prevents background noise

   **Low Compliance (<30%)**
   - Increases verbosity (more guidance)
   - Detailed explanations
   - More context and reasoning
   - Helps player understand why

   **Medium Compliance (30-70%)**
   - Standard verbosity
   - Balanced explanations
   - Normal operation

4. **Compliance Detection**

   Detects compliance by analyzing game state changes:
   - **Push**: Objectives taken
   - **Retreat/Back**: Health increased, position changed
   - **Farm**: Last hits increased
   - **End Game**: Ancient attacked/destroyed
   - **Group**: Team positioning (simplified)

### Integration

- Automatically tracks all advice given
- Checks compliance on each game state update
- Updates trust metrics in real-time
- Adjusts messaging behavior dynamically
- Logs metrics in post-game summary

### Example Metrics

```
Player Trust Metrics:
  Compliance Rate: 72.5%
  Positive Outcome Rate: 68.3%
  Verbosity Level: low
  Explanation Level: minimal
```

### Impact

- **Prevents Background Noise**: High-compliance players get fewer messages
- **Increases Engagement**: Low-compliance players get more explanation
- **Builds Trust**: System adapts to player behavior
- **Improves Learning**: More explanation when needed

---

## 3. Soft "Do Nothing" Messages ✅

### Implementation

**New Service**: `src/services/doNothingDetector.ts`

Encodes intentional silence as a state for internal consistency and future ML labeling.

### Features

1. **Do Nothing Detection**

   Detects when "do nothing" is optimal:
   - **Farming Phase**: Early game, no immediate objectives
   - **Waiting for Cooldowns**: Key abilities on cooldown
   - **Maintaining Advantage**: Ahead with no push windows
   - **Defensive Positioning**: Behind, playing safe

2. **State Encoding**

   Creates `DoNothingState` with:
   - `detected`: Boolean flag
   - `reason`: Why doing nothing is optimal
   - `confidence`: How certain we are (0-1)
   - `duration`: How long to maintain state (seconds)

3. **Internal Tracking**

   - Records "do nothing" as `CoachingAdvice` with `isDoNothing: true`
   - Includes net worth context
   - Tracks for post-game analysis
   - Available for future ML training

4. **Optional Display**

   - By default: Not shown to player (internal only)
   - If trust calibrator indicates need: Shown with explanation
   - Helps players understand when inaction is correct

### Example States

```typescript
{
  detected: true,
  reason: 'Farming phase - maintain map control, no immediate action needed',
  confidence: 0.8,
  duration: 60
}

{
  detected: true,
  reason: 'Key abilities on cooldown - wait before engaging',
  confidence: 0.7,
  duration: 30
}

{
  detected: true,
  reason: 'Maintaining map control - no action recommended',
  confidence: 0.75,
  duration: 90
}
```

### Impact

- **Internal Consistency**: System knows when silence is intentional
- **ML Labeling**: Future machine learning can learn from "do nothing" states
- **Player Education**: Helps players understand when inaction is optimal
- **System Completeness**: Covers all possible states, not just actions

---

## Integration Summary

All refinements are fully integrated:

### Flow

```
Game State Update
    ↓
Do Nothing Detector (check for intentional silence)
    ↓
Generate Advice
    ↓
Register with Trust Calibrator
    ↓
Calculate Confidence & Weight
    ↓
Check Compliance for Previous Advice
    ↓
Update Trust Metrics
    ↓
Adapt Verbosity/Explanation
    ↓
Send Advice (or suppress based on trust)
    ↓
Track for Post-Game Analysis (with confidence & context)
```

### Post-Game Analysis

```
End Game
    ↓
Calculate Confidence-Weighted Analysis
    ↓
Generate Weighted Recommendations
    ↓
Show: "You missed 2 high-confidence game-ending windows"
      vs
      "You missed several low-certainty suggestions"
```

---

## Professional Read

These refinements demonstrate:

### 1. Real-Time Systems Understanding
- Adaptive behavior based on feedback loops
- State management across game sessions
- Performance considerations (history limits)

### 2. Decision Theory
- Confidence-weighted decision making
- Uncertainty quantification
- Risk assessment and prioritization

### 3. Human Factors
- Psychological impact of messaging
- Trust calibration
- Adaptive communication

### 4. Iteration on Feedback
- Building on previous improvements
- Leverage multipliers (not feature bloat)
- Clean integration patterns

### 5. Design Restraint
- "Do nothing" as a first-class state
- Internal tracking without user bloat
- Optional features that don't overwhelm

---

## Usage

### Confidence-Weighted Memory

Automatically active. Post-game summaries now include:
- Confidence percentages for each event
- Weight scores (importance)
- High vs low confidence breakdowns

### Player Trust Calibration

Automatically active. System:
- Tracks compliance automatically
- Adapts messaging over time
- Logs metrics in post-game summary

To view metrics:
```typescript
const metrics = playerTrustCalibrator.getTrustMetrics();
console.log(metrics);
```

### Do Nothing Detection

Automatically active. System:
- Detects "do nothing" states internally
- Records for analysis
- Optionally shows if player needs explanation

To force display:
```typescript
// Already integrated - shows if trust calibrator indicates need
```

---

## Future Enhancements

### Machine Learning Integration

1. **Training Data**
   - "Do nothing" states provide negative examples
   - Confidence scores provide training labels
   - Compliance data provides reinforcement signals

2. **Predictive Models**
   - Predict optimal "do nothing" windows
   - Predict player compliance likelihood
   - Predict outcome probabilities

3. **Personalization**
   - Learn player-specific patterns
   - Adapt to player skill level
   - Customize messaging style

### Advanced Compliance Detection

1. **Position Tracking**
   - More accurate compliance detection
   - Better outcome assessment
   - Spatial reasoning

2. **Action Sequence Analysis**
   - Track action sequences
   - Detect partial compliance
   - Understand player intent

3. **Team Coordination**
   - Track team-wide compliance
   - Coordinate advice across team
   - Stack/party queue optimization

---

## Testing

All refinements work automatically. To verify:

1. **Confidence-Weighted Memory**: Check post-game summary for confidence percentages
2. **Trust Calibration**: Play multiple games, observe verbosity changes
3. **Do Nothing**: Check logs for "do nothing" state detections

All features are backward compatible and work in log-only mode.

