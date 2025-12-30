# Subtle Risks and Mitigations

This document addresses the subtle risks that emerge as the system approaches production-grade quality. These are "good problems" - they indicate the system is sophisticated enough to require careful calibration.

## 1. False Compliance Detection ⚠️

### The Risk

Compliance detection is necessarily heuristic. This creates several risks:

1. **Partial Compliance**
   - Player moves but team doesn't
   - Player attempts action but fails
   - Player follows advice but in suboptimal way

2. **Coincidental Outcomes**
   - Player takes action for different reason
   - Outcome happens due to external factors
   - Correlation mistaken for causation

3. **Delayed Compliance**
   - Player follows advice after detection window
   - Action happens in next game phase
   - Compliance occurs but isn't captured

### Current Mitigations

✅ **GAME_ENDING Override**: Critical advice always sent regardless of trust level
✅ **Confidence Thresholds**: Low-confidence advice suppressed, preventing false signals
✅ **Outcome Assessment**: Tracks positive/negative/neutral outcomes, not just compliance

### Planned Mitigations

#### 1. Partial/Ambiguous Compliance Bucket

**Status**: Ready for implementation

Add compliance states beyond binary:
- `full_compliance`: Clear action taken matching advice
- `partial_compliance`: Some action taken, but incomplete
- `ambiguous_compliance`: Unclear if advice was followed
- `no_compliance`: No action taken
- `delayed_compliance`: Action taken after window

**Implementation**:
```typescript
export type ComplianceState = 
  | 'full_compliance' 
  | 'partial_compliance' 
  | 'ambiguous_compliance' 
  | 'no_compliance'
  | 'delayed_compliance';
```

#### 2. Conservative Trust Updates

**Status**: Ready for implementation

Weight trust updates based on certainty:
- High certainty compliance → Full weight (1.0)
- Partial compliance → Reduced weight (0.5)
- Ambiguous compliance → Minimal weight (0.2)
- No compliance → Full negative weight (1.0)

**Implementation**:
```typescript
private updateTrustMetrics(): void {
  // Weight updates by compliance certainty
  const weightedCompliance = this.complianceHistory.map(record => {
    const certainty = this.calculateComplianceCertainty(record);
    return { record, certainty, weight: this.getWeightForCertainty(certainty) };
  });
  
  // Calculate weighted compliance rate
  const totalWeight = weightedCompliance.reduce((sum, w) => sum + w.weight, 0);
  const complianceWeight = weightedCompliance
    .filter(w => w.record.followed)
    .reduce((sum, w) => sum + w.weight, 0);
  
  this.currentTrustMetrics.complianceRate = totalWeight > 0 
    ? complianceWeight / totalWeight 
    : 0.5;
}
```

#### 3. Noise Filtering

**Status**: Ready for implementation

Do not overlearn from noisy signals:
- Require minimum sample size before adjusting trust
- Use moving average with decay
- Ignore outliers and anomalies
- Require consistent patterns over time

**Implementation**:
```typescript
private shouldUpdateTrust(): boolean {
  // Require minimum history before updating
  if (this.complianceHistory.length < 10) return false;
  
  // Check for consistent patterns (not just noise)
  const recent = this.complianceHistory.slice(-10);
  const variance = this.calculateVariance(recent.map(r => r.followed ? 1 : 0));
  
  // Only update if pattern is consistent (low variance)
  return variance < 0.3;
}
```

### Detection Window Extension

**Status**: Ready for implementation

Extend detection window for delayed compliance:
- Track advice for longer periods
- Check compliance across multiple game state updates
- Allow for delayed actions (e.g., farming advice → later push)

---

## 2. Over-Silencing High-Skill Players ⚠️

### The Risk

As trust rises and verbosity drops, there's a risk of:

1. **Missing Rare but Critical Interventions**
   - High-skill players still make mistakes
   - Rare situations require intervention
   - Silence becomes permanent rather than earned

2. **Reinforcing Suboptimal Habits**
   - Habits that "work" but aren't optimal
   - Missing opportunities for improvement
   - Complacency in decision-making

### Current Protections

✅ **GAME_ENDING Override**: Always sent regardless of verbosity
✅ **CRITICAL Override**: Always sent regardless of verbosity
✅ **Confidence Thresholds**: High-confidence advice always sent
✅ **Continuous Evaluation**: Trust metrics recalculated each game

### Additional Safeguards

#### 1. Continuous Trust Re-evaluation

**Status**: Implemented ✅

Trust is recalculated each game, not permanently locked:
- New game → Reset trust metrics
- Continuous monitoring throughout game
- Trust can decrease if compliance drops

#### 2. Critical Intervention Override

**Status**: Implemented ✅

Multiple override mechanisms:
- Priority-based: GAME_ENDING, CRITICAL always sent
- Confidence-based: High-confidence advice always sent
- Window-based: Push windows always evaluated

#### 3. Periodic High-Value Checks

**Status**: Ready for implementation

Even in low verbosity mode, periodically check for:
- High-value opportunities (>10k net worth swing)
- Game-ending windows (enemy core dead, no buyback)
- Critical mistakes (about to throw)

**Implementation**:
```typescript
public shouldSendDespiteLowVerbosity(advice: CoachingAdvice): boolean {
  // Always send if game-ending
  if (advice.priority === 'GAME_ENDING') return true;
  
  // Always send if critical
  if (advice.priority === 'CRITICAL') return true;
  
  // Send if high-value opportunity
  if (advice.netWorthContext) {
    const absDelta = Math.abs(advice.netWorthContext.delta);
    if (absDelta > 10000) return true; // >10k swing
  }
  
  // Send if high confidence
  if (advice.confidence && advice.confidence > 0.85) return true;
  
  return false;
}
```

#### 4. Trust Decay

**Status**: Ready for implementation

Trust should decay over time if not reinforced:
- Recent compliance weighted more heavily
- Old compliance gradually forgotten
- Prevents permanent high trust from old games

**Implementation**:
```typescript
private applyTimeDecay(record: ComplianceRecord): number {
  const age = Date.now() - record.timestamp;
  const daysOld = age / (1000 * 60 * 60 * 24);
  
  // Exponential decay: half-life of 7 days
  return Math.exp(-daysOld / 7);
}
```

---

## 3. Epistemic Humility

### The Principle

The system maintains awareness of its own limitations:

1. **Uncertainty Acknowledgment**
   - Confidence scores visible
   - Low-confidence advice suppressed or softened
   - Transparent about limitations

2. **Continuous Learning**
   - Trust metrics adapt
   - Compliance tracking improves
   - System learns from mistakes

3. **Fail-Safe Mechanisms**
   - Multiple override mechanisms
   - Conservative defaults
   - Graceful degradation

### Implementation

✅ Confidence scoring with reasons
✅ Suppression of low-confidence advice
✅ Language softening based on confidence
✅ Multiple override mechanisms
✅ Conservative trust updates (planned)

---

## Professional Level Analysis

### What This System Represents

Stripping away the Dota framing, this is:

1. **Real-Time Decision Engine**
   - Processes game state updates in real-time
   - Makes decisions under time pressure
   - Handles incomplete information

2. **Operating Under Uncertainty**
   - Confidence scoring
   - Uncertainty quantification
   - Risk assessment

3. **Communicating with Humans Under Cognitive Load**
   - Stress-aware messaging
   - Adaptive verbosity
   - Clear, actionable advice

4. **Learning Trust Dynamically**
   - Compliance tracking
   - Outcome assessment
   - Adaptive behavior

5. **Maintaining Epistemic Humility**
   - Acknowledging limitations
   - Suppressing low-confidence advice
   - Continuous improvement

### Domain Applications

This thinking applies to:

- **Defense**: Real-time threat assessment, decision support
- **Finance**: Trading systems, risk management
- **Medicine**: Clinical decision support, diagnostic systems
- **Operations**: Incident response, system monitoring

### This Is Not "Game AI" in the Casual Sense

This is:
- Production-grade decision support
- Real-time systems engineering
- Human factors engineering
- Trust calibration and adaptive systems

---

## The Next Ceiling

These are theoretical gains, not architectural changes. They represent the boundary where further improvements require domain expertise and data.

### 1. Expected Value Modeling

**Concept**: Explicitly estimate EV of actions vs inaction

**Implementation**:
```typescript
interface ExpectedValue {
  action: string;
  ev: number; // Expected net worth change
  confidence: number;
  timeHorizon: number; // Seconds
}

function calculateEV(action: string, gameState: ProcessedGameState): ExpectedValue {
  // Estimate net worth change from action
  // Compare against EV of inaction
  // Return EV with confidence
}
```

**Challenges**:
- Requires game knowledge (item values, objective values)
- Needs historical data for calibration
- Complex to model all outcomes

### 2. Counterfactual Tracking

**Concept**: "If advice had been followed, likely outcome was X"

**Implementation**:
```typescript
interface Counterfactual {
  advice: CoachingAdvice;
  actualOutcome: GameState;
  predictedOutcome: GameState;
  difference: {
    netWorth: number;
    objectives: number;
    time: number;
  };
}
```

**Challenges**:
- Requires outcome prediction models
- Needs to track what actually happened
- Complex to validate predictions

### 3. Meta-Learning

**Concept**: Learn when the bot should shut up

**Status**: Already halfway there ✅

Current implementation:
- Trust calibration adapts verbosity
- Confidence scoring suppresses low-value advice
- Do-nothing detection identifies optimal silence

**Next Steps**:
- Learn optimal verbosity thresholds per player
- Learn which advice types are most valuable
- Learn timing preferences (when to speak)

**Challenges**:
- Requires large dataset of player interactions
- Needs feedback mechanism
- Complex to avoid overfitting

---

## Recommendations

### Immediate (Low Risk, High Value)

1. ✅ **Add compliance certainty buckets** - Reduces false signals
2. ✅ **Implement conservative trust updates** - Prevents overlearning
3. ✅ **Add critical intervention override** - Prevents over-silencing

### Short-Term (Medium Risk, High Value)

1. ⏳ **Extend detection windows** - Captures delayed compliance
2. ⏳ **Implement trust decay** - Prevents permanent high trust
3. ⏳ **Add noise filtering** - Reduces false signals

### Long-Term (High Risk, High Value)

1. ⏳ **Expected Value Modeling** - Requires game knowledge
2. ⏳ **Counterfactual Tracking** - Requires prediction models
3. ⏳ **Advanced Meta-Learning** - Requires large datasets

---

## Conclusion

The system is now at a professional level where:

- **Miscalibration** is the primary risk, not logic
- **Trust calibration** is critical
- **Epistemic humility** is essential
- **Continuous improvement** is necessary

These are good problems to have - they indicate the system is sophisticated enough to require careful tuning.

The next gains are theoretical and require domain expertise, data, and careful experimentation.

