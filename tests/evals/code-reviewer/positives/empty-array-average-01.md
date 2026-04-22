---
id: empty-array-average-01
expected: true
---

```diff
+export const avg = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
```
