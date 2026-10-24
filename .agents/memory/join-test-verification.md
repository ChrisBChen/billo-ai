---
name: Join-form regression verification
description: Distinguishing genuine join-form remounts from browser selection and test URL mistakes.
---

Check the input's DOM identity, value, and selection range before typing after keyboard focus changes. Navigate using the exact URL captured from the app or API response rather than transcribing a bill ID.

**Why:** In join-flow verification, Shift+Tab selected the existing text, making subsequent typing look like a state reset. Separately, an accidentally shortened bill ID produced misleading mobile/direct-return 404 reports despite a healthy route.

**How to apply:** For join regressions, test slow typing through several refresh intervals and window focus changes; inspect the value before appending. Compare failing request URLs with the actual returned ID before changing routing or session code.
