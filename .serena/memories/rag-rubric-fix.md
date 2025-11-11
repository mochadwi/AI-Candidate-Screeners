# RAG Rubric Context Fix

## Issue
The `buildEvaluationPrompt()` function was receiving `cvRubricContext` and `projectRubricContext` from the vector store but wasn't using them. The prompt still contained hardcoded rubric text.

## Fix Applied
Replaced ~80 lines of hardcoded rubric text with actual retrieved context from the vector store.

### Before
```typescript
CV EVALUATION RUBRIC (1-5 scale):

1. Technical Skills Match (Weight: 40%)
   - 1: Irrelevant skills
   - 2: Few overlaps with requirements
   ...
[80 lines of hardcoded rubric]
```

### After
```typescript
=== CV EVALUATION RUBRIC (Retrieved from Ground Truth) ===
${cvRubricContext || 'Use standard 1-5 scale for: Technical Skills (40%), Experience (25%), Achievements (20%), Cultural Fit (15%)'}

=== PROJECT EVALUATION RUBRIC (Retrieved from Ground Truth) ===
${projectRubricContext || 'Use standard 1-5 scale for: Correctness (30%), Code Quality (25%), Resilience (20%), Documentation (15%), Creativity (10%)'}
```

## Benefits
1. ✅ **True RAG**: Rubric is now actually retrieved from vector store
2. ✅ **Flexibility**: Update rubric in ground truth files without code changes
3. ✅ **Version Control**: Rubric changes tracked in `ground-truth/rubrics/`
4. ✅ **Consistency**: Same rubric source for ingestion and evaluation
5. ✅ **Reduced Code**: Removed ~80 lines of hardcoded text

## What Gets Retrieved

The vector store retrieves relevant sections from:
- `ground-truth/rubrics/cv-scoring-rubric.md` (detailed CV scoring criteria)
- `ground-truth/rubrics/project-scoring-rubric.md` (detailed project scoring criteria)

## Fallback
If retrieval fails (empty context), fallback text provides basic parameter information so evaluation can still proceed.

## Files Modified
- `src/services/aiService.ts` - Replaced hardcoded rubric with retrieved context

## Build Status
✅ TypeScript compilation successful
✅ No errors

## Complete RAG Implementation
Now all ground truth documents are properly retrieved and used:
1. ✅ Job Description → Retrieved → Used in CV evaluation
2. ✅ Case Study Brief → Retrieved → Used in project evaluation
3. ✅ CV Rubric → Retrieved → Used in scoring (FIXED!)
4. ✅ Project Rubric → Retrieved → Used in scoring (FIXED!)
