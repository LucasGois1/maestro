---
id: path-traversal-01
expected: true
---

```diff
+await readFile("../uploads/" + req.query.file, "utf8");
```
