# Work Packet Template

```text
WORK PACKET

ID:
<short identifier>

Objective:
<one observable outcome>

Owner skill:
<$vcs-optics-geometry | $vcs-threejs-rtt | $vcs-ui-tasks | $vcs-verify-pr>

Branch and base:
<head branch>
<base branch or commit>

Known evidence:
- <facts, failing behavior, review thread, log, screenshot, or test>
- <do not include proposed conclusions unless already established>

Allowed files or ownership:
- <paths or module boundary>

Do not modify:
- <explicitly excluded systems>

Required behavior:
- <acceptance criterion>
- <acceptance criterion>

Required validation:
- <focused test command>
- <manual or E2E evidence when necessary>

Dependencies:
- <packet IDs or "none">

Output:
- status: completed / partial / blocked
- decision or root cause
- files changed
- tests run and results
- tests not run
- remaining risks
- commit SHA when committed
```

Keep a normal packet under 600 words. Include code excerpts only when the exact contract is otherwise ambiguous.
