---
id: shell-injection-01
expected: true
---

```diff
+exec("git checkout " + branchName);
```
