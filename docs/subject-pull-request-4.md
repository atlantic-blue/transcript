# The pull request to land

Repository: `atlantic-blue/transcript`. I fetched first, then I read. `origin/main` is at `3b5f6cc`.
I read this on 1 September 2026.

## The subject

- Number: 4
- Address: https://github.com/atlantic-blue/transcript/pull/4
- Title: fix: report what the platform actually answered instead of a missing video
- Head branch: `diagnose-the-boundary-and-report-the-real-cause`
- Head commit: `84d9fe37c3414e82dc8937a7046a626cc590d8c0`
- Base branch: `main`
- Draft: no
- Conflicts with `main`: no
- Checks that are not passing: `plan and apply`

Pull request 4 is the oldest of the nine open pull requests. It opened on 31 August 2026. It is
eligible on its failing check, not on a conflict.

## The three check runs on the head commit

- `code`: success
- `infrastructure`: success
- `plan and apply`: failure

The failing job is here:

https://github.com/atlantic-blue/transcript/actions/runs/33387270234/job/99472620061

There is no commit status on this head commit. The combined status endpoint answers `pending` with
zero contexts. That is an absence, not a failure.

## The usual command hides the failure

`gh pr checks 4` prints two checks. It prints `code` and `infrastructure`. It calls both a pass. It
exits 0. It does not print `plan and apply`. Read the commit instead:

```
gh api repos/atlantic-blue/transcript/commits/84d9fe37/check-runs \
  --jq '.check_runs[] | "\(.name) \(.conclusion)"'
```

That command answers with three names. `plan and apply` is a failure.

The trigger is the cause. The `deploy` workflow starts on a push to `main`. It also starts on a
manual start. It does not start on a pull request. So GitHub keeps that run out of the pull request
summary. An absent check reads the same as a passing one.

## No check is required in this repository

`repos/atlantic-blue/transcript/branches/main/protection` answers 404 with "Branch not protected".
So no check is mandatory, and no check blocks a merge. I read the test as "a check that is not
passing", not "a check that a branch rule makes mandatory". I name that judgement here. Under the
strict reading, nothing is eligible, and a real red check on the oldest pull request stays hidden.

## The other eight open pull requests

Each one is newer than pull request 4. None conflicts with `main`. Both check runs on each head
commit pass. So none qualifies.

- Number 5, `docs: name the pull request to land`, head `46b9460a`, opened 00:57. Adds `subject.md`.
- Number 6, `docs: the subject to land is pull request 4`, head `9597c60c`, opened 07:12. Adds `subject.md`.
- Number 7, `docs: name pull request 4 as the subject to land`, head `e44acfdb`, opened 07:13. Adds `subject.md`.
- Number 8, `docs: say what landing pull request 4 found`, head `c2878ae4`, opened 07:23. Adds `land.md`.
- Number 9, `docs: record pull request 4 as the subject to land`, head `d3ced9d9`, opened 07:33. Adds `docs/subject.md`.
- Number 10, `docs: record what landing pull request 4 found`, head `a258d485`, opened 07:44. Adds `docs/land.md`.
- Number 11, `docs: name pull request 4 as the subject to land`, head `b09ec2fc`, opened 07:51. Adds `docs/the-subject-to-land.md`.
- Number 12, `docs: record what landing pull request 4 found`, head `0a959240`, opened 07:58. Adds `docs/landing-pull-request-4.md`.

Pull requests 5, 6, 7, 9 and 11 are the output of earlier rounds of this same task. Each names pull
request 4. Pull requests 8, 10 and 12 report the round that worked it.

## The exclusions I checked

- No pull request is a draft. `draft` is false on all nine.
- No pull request is based on another pull request's head branch. Every `base.ref` is `main`. So
  landing pull request 4 breaks no child.
- No pull request conflicts. GitHub answers `mergeable=true` and `mergeable_state=clean` for all
  nine. I also ran `git merge-tree --write-tree origin/main <head>` for each one. Each exits 0 and
  prints no conflict line.

## A collision that is already there

Pull requests 5, 6 and 7 each add `subject.md` at the root. `main` holds no such file, so none of
the three conflicts with `main` today. The first of them to merge creates the file. Then the other
two conflict on add over add, and a person must resolve them by hand. The pull request that carries
this report writes `docs/subject-pull-request-4.md`, so it conflicts with none of the eight.

## What landing pull request 4 will not do

An earlier round worked pull request 4 to the end. Its report is at `/home/agent/shared/land/land.md`,
and it also ships as pull request 10. The short version: the branch needs no merge, every gate that
can run passes on it, and the red step is a correct gate. That step asks the deployed page for a
transcript. The page answers 502. Every `deploy` run in this repository failed, on `main` as well as
on this branch, so pull request 4 does not cause the failure. It inherits it.

I did not verify those readings again. I checked the state that decides the pick: the pull request
list, the draft flag, the base branch, the mergeability and the check runs.
