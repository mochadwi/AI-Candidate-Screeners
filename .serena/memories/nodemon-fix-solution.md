# Nodemon Restart Issue Fix for AI CV Evaluation

## Problem
The server restarts during AI evaluation process, causing jobs to remain stuck in "processing" status. This happens because:

1. Nodemon detects file changes during PDF processing or AI evaluation
2. Server restart kills the long-running async process
3. Job status remains "processing" indefinitely

## Solutions

### Solution 1: Configure Nodemon (Recommended)
Create `nodemon.json` to ignore files that trigger unwanted restarts:

```json
{
  "watch": ["src"],
  "ext": "ts,json",
  "ignore": [
    "uploads/**/*",
    "data/**/*",
    "logs/**/*",
    "*.log",
    "tmp/**/*",
    ".git/**/*",
    "node_modules/**/*",
    "dist/**/*",
    "coverage/**/*"
  ],
  "exec": "ts-node src/index.ts",
  "delay": 1000
}
```

### Solution 2: Use Production Mode for Testing
Instead of `npm run dev`, use:
```bash
npm run build
npm start
```

### Solution 3: Disable Nodemon Temporarily
For testing long-running processes:
```bash
npx ts-node src/index.ts
```

### Solution 4: Process Management with PM2
For production-ready solution:
```bash
npm install -g pm2
pm2 start "npx ts-node src/index.ts" --name ai-cv-evaluator
```

## Files to Create/Modify

1. Create `nodemon.json` with proper ignore patterns
2. Update `package.json` scripts if needed
3. Consider adding job timeout mechanisms

## Additional Recommendations

1. **Add job timeouts** to prevent infinite processing
2. **Implement job persistence** across server restarts
3. **Add monitoring** for stuck jobs
4. **Use proper process management** in production

## Testing Steps

1. Apply the nodemon configuration
2. Restart the server
3. Test evaluation with a new job
4. Monitor logs to ensure no unwanted restarts
5. Verify jobs complete successfully