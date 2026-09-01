# The pull request to land

Repository: `atlantic-blue/transcript`. I fetched before I read. `origin/main` is at `3b5f6cc`.
I read the repository on 1 September 2026.

## The subject

- Number: 4
- Address: https://github.com/atlantic-blue/transcript/pull/4
- Title: fix: report what the platform actually answered instead of a missing video
- Head branch: `diagnose-the-boundary-and-report-the-real-cause`
- Head commit: `84d9fe37c3414e82dc8937a7046a626cc590d8c0`
- Base branch: `main`
- Draft: no
- Conflicts with main: no
- Checks that are not passing: `plan and apply`

Pull request 4 is the oldest of the seven open pull requests. It opened on 31 August 2026. One
check on its head commit failed. It qualifies on that failing check.

## The three checks on the head commit

- `code`: success
- `infrastructure`: success
- `plan and apply`: failure

The failing job is here:

https://github.com/atlantic-blue/transcript/actions/runs/33387270234/job/99472620061

There are no commit statuses on any head commit in this repository. The combined status endpoint
answers `pending` with zero contexts for all seven pull requests. That is an absence, not a
failure.

## The usual command hides the failure

`gh pr checks 4` prints two checks. It prints `code` and `infrastructure`, it calls both a pass,
and it exits 0. It does not print `plan and apply`.

Read the commit instead:

```
gh api repos/atlantic-blue/transcript/commits/84d9fe37/check-runs \
  --jq '.check_runs[] | "\(.name) \(.conclusion)"'
```

That command answers with three names. `plan and apply` is a failure.

The trigger is the cause. The `deploy` workflow starts on a push to `main` and on a manual start.
It does not start on a pull request. Somebody started run 33387270234 by hand on the branch, so
GitHub keeps it out of the pull request summary. An absent check reads the same as a passing one.

## No check is required in this repository

`repos/atlantic-blue/transcript/branches/main/protection` answers 404 with "Branch not protected".
The ruleset list is empty. So no check is required, and no check blocks a merge.

I read the test as "a check that is failing", not "a check that a branch rule makes mandatory".
Under the strict reading no pull request here is eligible, because no check is required and none
conflicts. That reading hides a real red check on the oldest pull request. So I picked pull request
4, and I name the judgement here rather than hide it.

## What the failing check says

The deploy worked. Terraform planned and applied. The job failed on its last step, step 15, "read a
transcript from the page that is now serving". The page answered 502 eight times over four minutes.

Every `deploy` run in this repository failed, on `main` as well as on this branch:

- run 33387270234, branch `diagnose-the-boundary-and-report-the-real-cause`, commit `84d9fe37`
- run 33386170462, same branch, commit `9f98ba0c`
- run 33313972826, `main`, commit `3b5f6cc2`
- run 33312928308, `main`, commit `75b62fb2`
- run 33312819570, `main`, commit `75b62fb2`
- run 33311209287, `main`, commit `e61e38df`

So pull request 4 does not cause this failure. It inherits it from `main`.

## Landing this pull request will not turn the check green

An earlier session worked pull request 4 to the end. Its report is at
`/home/agent/shared/land/land.md`, and it also ships as pull request 10. Read it before you start.
The short version:

- The branch needs no merge. `origin/main` is already its base.
- Every gate that can pass, passes on the branch: the typecheck, the linter, 114 tests, the build,
  the package check, `terraform fmt` and `terraform validate`.
- The red step is a correct gate. It asks the deployed page for a transcript, and the page cannot
  give one.
- The cause is at the platform. The platform refuses the address the function calls from. The
  function log records `"cause":"bot_check"` and `"playability":"LOGIN_REQUIRED"`. The same code
  reads 560 caption segments from this sandbox, so the code is not the fault.

To make that step pass, somebody must give the function a different address to call from. Each way
to do that bills money while nobody visits: a network address translation gateway, a paid proxy
service, or an always on host. The project context refuses two of them by name. So this is a
decision for a person, and it is not a task to build.

I did not verify those readings again in this session. I checked the state that decides the pick:
the pull request list, the draft flag, the base branch, the mergeability and the check runs.

## The other six open pull requests, and why I did not pick them

Each one is newer than pull request 4. None conflicts with `main`. Every check on every one of
them passed. So none qualifies.

- Number 5, `docs: name the pull request to land`, branch `docs-name-the-pull-request-to-land`,
  head `46b9460a`, opened 1 September 2026 at 00:57. `code` and `infrastructure` pass. Adds
  `subject.md`.
- Number 6, `docs: the subject to land is pull request 4`, branch
  `docs-the-subject-to-land-is-pull-request-4`, head `9597c60c`, opened at 07:12. `code` and
  `infrastructure` pass. Adds `subject.md`.
- Number 7, `docs: name pull request 4 as the subject to land`, branch
  `docs-name-the-subject-to-land`, head `e44acfdb`, opened at 07:13. `code` and `infrastructure`
  pass. Adds `subject.md`.
- Number 8, `docs: say what landing pull request 4 found`, branch
  `docs-what-landing-pull-request-4-found`, head `c2878ae4`, opened at 07:23. `code` and
  `infrastructure` pass. Adds `land.md`.
- Number 9, `docs: record pull request 4 as the subject to land`, branch
  `docs-record-the-subject-to-land`, head `d3ced9d9`, opened at 07:33. `code` and `infrastructure`
  pass. Adds `docs/subject.md`.
- Number 10, `docs: record what landing pull request 4 found`, branch
  `docs-land-pull-request-4-the-platform-refuses-the-function`, head `a258d485`, opened at 07:44.
  `code` and `infrastructure` pass. Adds `docs/land.md`.

Pull requests 5, 6, 7 and 9 are the output of four earlier rounds of this same task. Each names
pull request 4. Pull requests 8 and 10 report the round that worked it.

## A collision that is already there

Pull requests 5, 6 and 7 each add a file called `subject.md` at the root. Pull request 9 adds
`docs/subject.md`. `main` holds neither path, so none of the four conflicts with `main` today. The
first of 5, 6 and 7 to merge creates the root file. Then the other two conflict on add over add,
and somebody must resolve them by hand.

I did not make that pile bigger. The pull request that carries this report writes
`docs/the-subject-to-land.md`, so it conflicts with none of the six.

## The exclusions I checked

- No pull request is a draft. `draft` is false on all seven.
- No pull request is based on another pull request's head branch. All seven have a `base.ref` of
  `main`, so landing pull request 4 breaks no child.
- No pull request conflicts with `main`. GitHub answers `mergeable=true` and
  `mergeable_state=clean` for all seven. I also ran `git merge-tree --write-tree origin/main
  <head>` for each one. Each exits 0 and reports no conflict line.
- There are seven open pull requests. `repos/atlantic-blue/transcript/pulls?state=open` returns a
  list of length 7.

## What I did not do

I changed nothing in pull request 4. I changed nothing on `main`. I merged nothing. This step
reads and records.
