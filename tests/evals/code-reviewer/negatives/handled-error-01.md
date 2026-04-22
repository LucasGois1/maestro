---
id: handled-error-01
expected: false
---

```diff
+try:
+    charge_customer()
+except PaymentError as error:
+    logger.exception("payment failed", exc_info=error)
+    raise
```
