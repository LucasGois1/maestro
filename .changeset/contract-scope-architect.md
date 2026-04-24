---
'@maestro/contract': patch
'@maestro/agents': patch
'@maestro/pipeline': patch
---

Remove sprint contract `sensors_required` and `thresholds` (sensors run from `.maestro/sensors.json` by default). Strip those keys when parsing legacy contract YAML. Seed contract `scope` from Architect `scopeTecnico`, copy planner `dependsOn` into `depends_on`, and align evaluator prompt with full-sensor default.
