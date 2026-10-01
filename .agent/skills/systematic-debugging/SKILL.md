---
name: systematic-debugging
description: Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes. Enforces root cause investigation before any code change.
---

# Systematic Debugging

## Overview

**Core principle:** ALWAYS find root cause before attempting fixes. Symptom fixes are failure.

**Violating the letter of this process is violating the spirit of debugging.**

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

If you haven't completed Phase 1, you cannot propose fixes.

## When to Use

Use for ANY technical issue:
- Test failures
- Bugs in production
- Unexpected behavior
- Performance problems
- Build failures
- Integration issues
- API errors (500, 404, etc.)
- Database constraint violations

**Use this ESPECIALLY when:**
- Under time pressure (emergencies make guessing tempting)
- "Just one quick fix" seems obvious
- You've already tried multiple fixes
- Previous fix didn't work
- You don't fully understand the issue

**Don't skip when:**
- Issue seems simple (simple bugs have root causes too)
- You're in a hurry (systematic is faster than thrashing)

## The Four Phases

You MUST complete each phase before proceeding to the next.

### Phase 1: Root Cause Investigation

**BEFORE attempting ANY fix:**

1. **Read Error Messages Carefully**
   - Don't skip past errors or warnings
   - They often contain the exact solution
   - Read stack traces completely
   - Note line numbers, file paths, error codes
   - For PostgreSQL: note the error code (e.g., `23502`, `22P02`, `23505`)

2. **Reproduce Consistently**
   - Can you trigger it reliably?
   - What are the exact steps?
   - Does it happen every time?
   - If not reproducible → gather more data, don't guess

3. **Check Recent Changes**
   - What changed that could cause this?
   - Git diff, recent commits
   - New dependencies, config changes
   - Environmental differences (local vs VPS)

4. **Gather Evidence in Multi-Component Systems**

   **WHEN system has multiple components (Frontend → API → PostgreSQL):**

   **BEFORE proposing fixes, add diagnostic instrumentation:**
   ```
   For EACH component boundary:
     - Log what data enters component
     - Log what data exits component
     - Verify environment/config propagation
     - Check state at each layer

   Run once to gather evidence showing WHERE it breaks
   THEN analyze evidence to identify failing component
   THEN investigate that specific component
   ```

   **Plataforma ULTEC specific boundaries:**
   ```
   Frontend (React) → Express API (backend-insforge) → Supabase Client → PostgreSQL (supabase-db)
   ```

5. **Trace Data Flow**
   - Where does bad value originate?
   - What called this with bad value?
   - Keep tracing up until you find the source
   - Fix at source, not at symptom

### Phase 2: Pattern Analysis

**Find the pattern before fixing:**

1. **Find Working Examples**
   - Locate similar working code in same codebase
   - What works that's similar to what's broken?

2. **Compare Against References**
   - If implementing pattern, read reference implementation COMPLETELY
   - Don't skim — read every line
   - Understand the pattern fully before applying

3. **Identify Differences**
   - What's different between working and broken?
   - List every difference, however small
   - Don't assume "that can't matter"

4. **Understand Dependencies**
   - What other components does this need?
   - What settings, config, environment?
   - What assumptions does it make?

### Phase 3: Hypothesis and Testing

**Scientific method:**

1. **Form Single Hypothesis**
   - State clearly: "I think X is the root cause because Y"
   - Write it down before doing anything
   - Must be falsifiable

2. **Design Minimal Test**
   - Smallest change to test hypothesis
   - Don't fix multiple things at once
   - Measure before and after

3. **If Hypothesis Wrong**
   - REVERT changes
   - Return to Phase 1 with new information
   - Don't stack guesses

### Phase 4: Fix and Verify

**After confirmed root cause:**

1. **Implement Minimal Fix**
   - Fix the root cause, not symptoms
   - Smallest change that resolves issue
   - Don't refactor while debugging

2. **Verify Fix**
   - Run the exact reproduction steps
   - Confirm the error no longer occurs
   - Check for regressions
   - Build both frontend and backend (`npm run build` with 0 errors)

3. **Clean Up**
   - Remove diagnostic instrumentation
   - Document what was found

## Emergency Stop Rule

**After 3 consecutive failed fix attempts:**

1. **STOP completely**
2. List everything you've tried
3. Describe what you've learned
4. Present to the user for architectural review
5. Do NOT try a 4th fix without explicit approval

## Plataforma ULTEC Checklist

- [ ] Did I read the full error message including PostgreSQL error codes?
- [ ] Did I check `docker logs ultec-backend` or `test-backend` for server-side errors?
- [ ] Did I verify the data flow: Frontend → API → Supabase → PostgreSQL?
- [ ] Did I check if `branch_id` is being properly propagated?
- [ ] Did I verify the fix with `npm run build` (0 errors) before deploying?
- [ ] Did I test in isolated container before touching production?
