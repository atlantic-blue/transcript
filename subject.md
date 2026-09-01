# The pull request to land

I read this on 1 September 2026. I fetched first. `origin/main` is at `3b5f6cc`.

## The subject

- Number: 4
- Address: https://github.com/atlantic-blue/transcript/pull/4
- Title: fix: report what the platform actually answered instead of a missing video
- Head branch: `diagnose-the-boundary-and-report-the-real-cause`
- Head commit: `84d9fe37c3414e82dc8937a7046a626cc590d8c0`
- Conflicts with main: no
- Checks that are not passing: `plan and apply`

## Why this one

Two pull requests are open. Number 4 is the older one. It qualifies on a failing check.

It is not a draft. Its base is `main`. No other pull request uses its head branch as a base, so it
has no child to break.

It does not conflict. I tested the merge two ways. `git merge-tree --write-tree origin/main pr4`
exits 0. The interface reports `MERGEABLE` and a merge state of `CLEAN`. The head commit already
contains `3b5f6cc`, which is the tip of `main`.

## The failing check, and where it hides

The head commit carries three check runs. One of them fails:

```
plan and apply    failure
infrastructure    success
code              success
```

`gh pr checks 4` prints only `code` and `infrastructure`, and both pass. A person can therefore read
this pull request as fully green. The `plan and apply` run started from a manual dispatch and not
from the pull request, so the interface keeps it out of the pull request summary. Read the head
commit itself to see it:

```
gh api repos/atlantic-blue/transcript/commits/84d9fe37c3414e82dc8937a7046a626cc590d8c0/check-runs \
  --jq '.check_runs[] | "\(.name) \(.conclusion)"'
```

An absent check reads the same as a passing one. This is the trap in this repository.

## What the failing check says

`plan and apply` is the only job of the `deploy` workflow. It deploys, then it asks the deployed
page for a transcript. It tried eight times across four minutes. Every attempt answered 502. The
last two lines of the job are:

```
the page answered 502 with 4777 bytes, and said: The platform refused this page, not your video
##[error]the page answered 502 and said: The platform refused this page, not your video
```

The run is https://github.com/atlantic-blue/transcript/actions/runs/33387270234 and the job is
https://github.com/atlantic-blue/transcript/actions/runs/33387270234/job/99472620061.

That 502 and that sentence are what pull request 4 adds. The same check failed before it with a 404
that said the video did not exist. So the pull request does what its title says. The product still
cannot read a transcript from the deployed function.

## This failure is older than the branch

Do not read the failing check as damage this pull request caused. `plan and apply` failed on every
run of the `deploy` workflow, including the runs against `main`. On `main` at `3b5f6cc`, job
99264026424 tried eight times and got 404 every time. The deploy job never passed in this
repository.

## The other open pull request, and why I did not pick it

- Number 5, "docs: name the pull request to land", head branch `docs-name-the-pull-request-to-land`,
  head commit `46b9460a1d60528647fa19f8f691d36ee9155c07`. It is newer than 4. It does not qualify.
  It does not conflict: `git merge-tree` exits 0 and the interface reports `MERGEABLE` and `CLEAN`.
  Every check on its head commit passes. Its head commit carries `code` and `infrastructure` only,
  and both report success.

Pull requests 1, 2 and 3 are merged. They are not open, so they are not eligible.

## One thing the next session must know

Pull request 5 also adds a file named `subject.md` at the root. This pull request adds the same file
name. The two therefore conflict with each other, although neither conflicts with `main`. Land one
of them and the other needs a merge.

## What is not checked

There is no branch protection on `main`, so no check is formally required. The interface answers 404
for the protection of that branch. I read "a required check is failing" as "a check on the head
commit is not passing", because a strict reading makes the test impossible to satisfy in this
repository.
