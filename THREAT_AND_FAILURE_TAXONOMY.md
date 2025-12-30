# Formal Threat and Failure Taxonomy

## Purpose

This document enumerates credible failure modes of the decision-support system, including technical, cognitive, and operational risks. The goal is not to eliminate all failure, but to bound risk, document assumptions, and ensure predictable behavior under adverse or degraded conditions.

This taxonomy is intended to support audits, red-team review, and long-term system stewardship.

---

## 1. Inference and Modeling Failures

### 1.1 Misclassified Compliance States

**Description**: The system incorrectly classifies player response to advice (e.g., partial compliance interpreted as no compliance).

**Impact**: Incorrect trust updates; potential suppression or over-amplification of future advice.

**Mitigations**:
- ✅ Five-state compliance model (full, partial, ambiguous, delayed, none)
- ✅ Certainty scoring for each classification
- ✅ Trust updates weighted by certainty
- ✅ Minimum history thresholds before behavioral adaptation

**Residual Risk**: Low in aggregate; medium in sparse or highly noisy scenarios.

**Implementation Status**: Fully implemented in `src/services/playerTrustCalibrator.ts`

---

### 1.2 Confidence Inflation Under Correlated Noise

**Description**: Multiple weak signals reinforce each other, producing artificially high confidence.

**Impact**: Overconfident advice in situations with incomplete or correlated data.

**Mitigations**:
- ✅ Independent uncertainty dimensions (vision, timing, completeness, net worth reliability)
- ✅ Confidence caps when uncertainty sources overlap (weighted averaging prevents simple addition)
- ✅ Conservative confidence aggregation (minimum of dimensions considered)
- ⏳ Confidence distribution tracking (ready for implementation)

**Residual Risk**: Low; monitored via confidence distribution tracking.

**Implementation Status**: Core mitigations implemented in `src/services/confidenceCalculator.ts`

---

## 2. Control and Adaptation Failures

### 2.1 Trust Decay Lag

**Description**: Trust calibration reacts too slowly to genuine behavioral change.

**Impact**: Advice verbosity temporarily misaligned with player behavior.

**Mitigations**:
- ✅ Sliding window trust evaluation (last 100 records)
- ✅ Recalculation each session (new game resets trust)
- ⏳ Faster decay than accumulation (ready for implementation - time-weighted decay)
- ✅ Pattern consistency requirements (prevents rapid swings)

**Residual Risk**: Medium during abrupt behavior shifts; bounded temporally.

**Implementation Status**: Core mitigations implemented; time decay ready for enhancement

---

### 2.2 Override Mechanism Conflicts

**Description**: Multiple override conditions (priority, confidence, value) trigger simultaneously or inconsistently.

**Impact**: Unexpected advice delivery patterns.

**Mitigations**:
- ✅ Explicit override precedence ordering:
  1. GAME_ENDING priority (highest)
  2. CRITICAL priority
  3. High confidence (>85%)
  4. High-value opportunity (>10k net worth swing)
- ✅ Deterministic conflict resolution (priority-based)
- ✅ Logging of override triggers for audit (via logger)

**Residual Risk**: Low.

**Implementation Status**: Fully implemented in `src/services/coachingEngine.ts`

---

## 3. Human Interaction Failures

### 3.1 User Over-Reliance

**Description**: Users defer decision-making excessively to the system.

**Impact**: Skill atrophy; inappropriate attribution of authority.

**Mitigations**:
- ✅ Explicit confidence transparency (confidence scores visible in logs)
- ✅ Suppression of low-confidence advice (prevents false authority)
- ✅ Language framing as recommendation, not command (softened language)
- ✅ "Do nothing" states explicitly encoded (teaches when inaction is optimal)

**Residual Risk**: Medium; intrinsic to decision-support systems.

**Implementation Status**: Fully implemented across multiple services

---

### 3.2 Adversarial or Gaming Behavior

**Description**: Users intentionally manipulate compliance signals to influence system behavior.

**Impact**: Trust calibration corruption; degraded advice quality.

**Mitigations**:
- ✅ Certainty-weighted compliance detection (reduces impact of ambiguous signals)
- ✅ Pattern consistency requirements (requires sustained behavior change)
- ✅ Conservative learning rates (weighted updates, minimum history)
- ✅ Noise filtering (variance checks, certainty thresholds)

**Residual Risk**: Low to medium; increases with user sophistication.

**Implementation Status**: Fully implemented in `src/services/playerTrustCalibrator.ts`

---

## 4. Operational and Deployment Failures

### 4.1 Cold Start Conditions

**Description**: Insufficient historical data for trust calibration.

**Impact**: Generic advice behavior; suboptimal personalization.

**Mitigations**:
- ✅ Conservative default verbosity (medium level)
- ✅ Gradual adaptation (requires 10+ records before trust updates)
- ✅ Early confidence suppression (low-confidence advice suppressed from start)
- ✅ Default trust metrics (0.5 compliance rate, standard verbosity)

**Residual Risk**: Low and time-limited.

**Implementation Status**: Fully implemented

---

### 4.2 Sparse or Degraded Data Regimes

**Description**: Loss or degradation of key signals (vision, timing, telemetry).

**Impact**: Increased uncertainty; potential advice suppression.

**Mitigations**:
- ✅ Uncertainty-aware confidence scoring (data completeness tracked)
- ✅ Graceful degradation (system continues operating with reduced confidence)
- ✅ Silence as a valid action (do-nothing states explicitly encoded)
- ✅ Confidence-based suppression (low-confidence advice suppressed, not system failure)

**Residual Risk**: Low.

**Implementation Status**: Fully implemented in `src/services/confidenceCalculator.ts`

---

## 5. System Integration Failures

### 5.1 GSI Data Loss or Corruption

**Description**: Game State Integration data becomes unavailable or corrupted.

**Impact**: System cannot generate advice; potential silent failures.

**Mitigations**:
- ✅ Null checks and graceful handling in game state processor
- ✅ Logging of data quality issues
- ✅ System continues operating (returns null advice rather than crashing)
- ✅ Health check endpoint for monitoring

**Residual Risk**: Low.

**Implementation Status**: Fully implemented in `src/services/gameStateProcessor.ts`

---

### 5.2 Steam Bot Connection Failures

**Description**: Steam bot loses connection or fails to authenticate.

**Impact**: Advice generated but not delivered to player.

**Mitigations**:
- ✅ Log-only mode fallback (advice still logged)
- ✅ Connection retry logic (Steam client handles reconnection)
- ✅ Graceful degradation (system continues analyzing even if bot disconnected)
- ✅ Error logging for monitoring

**Residual Risk**: Low.

**Implementation Status**: Fully implemented in `src/services/steamBot.ts`

---

## Summary

This system is designed to fail conservatively, degrade gracefully, and surface uncertainty explicitly. Residual risks are known, bounded, and continuously monitored.

### Risk Posture

- **Conservative by Design**: Silence is treated as valid action
- **Transparency**: Confidence scores visible, uncertainty acknowledged
- **Bounded Adaptation**: Slow, reversible, pattern-consistent
- **Multiple Safeguards**: Override mechanisms prevent critical failures
- **Graceful Degradation**: System continues operating under adverse conditions

### Monitoring and Auditing

- All override triggers logged
- Compliance states tracked with certainty scores
- Confidence distributions trackable
- Trust metrics observable
- Post-game analysis provides audit trail

### Continuous Improvement

- Risk mitigations implemented incrementally
- New failure modes can be added to taxonomy
- Monitoring enables detection of new patterns
- System designed for long-term stewardship

---

## Appendix: Implementation Mapping

| Risk | Mitigation Status | Implementation Location |
|------|------------------|------------------------|
| 1.1 Misclassified Compliance | ✅ Implemented | `src/services/playerTrustCalibrator.ts` |
| 1.2 Confidence Inflation | ✅ Implemented | `src/services/confidenceCalculator.ts` |
| 2.1 Trust Decay Lag | ✅ Core Implemented | `src/services/playerTrustCalibrator.ts` |
| 2.2 Override Conflicts | ✅ Implemented | `src/services/coachingEngine.ts` |
| 3.1 User Over-Reliance | ✅ Implemented | Multiple services |
| 3.2 Adversarial Behavior | ✅ Implemented | `src/services/playerTrustCalibrator.ts` |
| 4.1 Cold Start | ✅ Implemented | `src/services/playerTrustCalibrator.ts` |
| 4.2 Degraded Data | ✅ Implemented | `src/services/confidenceCalculator.ts` |
| 5.1 GSI Data Loss | ✅ Implemented | `src/services/gameStateProcessor.ts` |
| 5.2 Steam Bot Failure | ✅ Implemented | `src/services/steamBot.ts` |

---

## Document Control

- **Version**: 1.0
- **Last Updated**: 2024
- **Review Cycle**: Quarterly or upon significant system changes
- **Owner**: System Architect
- **Audience**: Technical reviewers, auditors, long-term maintainers

