| id | rule | why | scope | enforced_by | severity |
|---|---|---|---|---|---|
| L-starter-bounded-list | A list that is cut to a limit says it was cut (a count, a "more" marker or a truncation note) | a silently truncated list reads as the whole list | `**` | review | major |
| L-starter-error-path | An error path tells the user what failed and what to do next | a silent or generic failure leaves the user guessing | `**` | review | major |
| L-starter-no-swallowed-errors | No error is caught and dropped; handle it, log it with context, or re-raise it | a swallowed error hides the real failure until it surfaces somewhere else | `**` | review | major |
| L-starter-no-duplicate-helper | A new helper must not duplicate an existing one; search first and reuse or extend | parallel helpers drift apart and fix only one copy of a bug | `**` | review | minor |
| L-starter-tests-assert-values | A test asserts concrete values, not only that a call ran or returned something | a test that checks no value passes on wrong output | `**` | review | major |
| L-starter-limits-in-config | Limits and magic numbers live in config or a named constant, not inline | an inline number can't be found, tuned or explained | `**` | review | minor |
