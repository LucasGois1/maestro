---
id: xss-inner-html-01
expected: true
---

```diff
+element.innerHTML = request.query.name;
```
