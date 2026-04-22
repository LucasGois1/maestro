---
id: sql-injection-01
expected: true
---

```diff
+db.execute("SELECT * FROM users WHERE id = " + user_id)
```
