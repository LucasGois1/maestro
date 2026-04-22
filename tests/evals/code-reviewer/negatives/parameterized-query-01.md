---
id: parameterized-query-01
expected: false
---

```diff
+db.execute("SELECT * FROM users WHERE id = ?", [userId]);
```
