---
id: clean-refactor-01
expected: false
---

```diff
+export function formatName(first: string, last: string) {
+  return `${first} ${last}`.trim();
+}
```
