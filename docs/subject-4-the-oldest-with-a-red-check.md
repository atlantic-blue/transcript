# The pull request to land

Repository `atlantic-blue/transcript`. I fetched first. Then I read. I read this on 1 September
2026. `origin/main` is at `3b5f6cc2038dfd13b17fc55714b525be076336e4`.

Thirteen pull requests are open. They are the numbers 4 to 16.

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

Pull request 4 opened on 31 August 2026 at 11:30. It is the oldest of the thirteen. It is the only
one with a check that is not passing. The test has two parts. Pull request 4 meets the second part.
It does not meet the first part. No open pull request meets the first part.

## The check that is not passing

`plan and apply` completed on 31 August 2026 at 11:35. Its conclusion is failure. The job is here:

https://github.com/atlantic-blue/transcript/actions/runs/33387270234/job/99472620061

That run is the only `deploy` run on this head commit. No later run replaced it.

The three check runs on the head commit are these:

- `code`: completed, success
- `infrastructure`: completed, success
- `plan and apply`: completed, failure

## The pull request summary hides that check

`gh pr checks 4` prints two lines. It prints `code` and `infrastructure`. It calls both a pass. It
exits 0. It does not print `plan and apply`. Read the head commit instead:

```
gh api repos/atlantic-blue/transcript/commits/84d9fe37/check-runs \
  --jq '.check_runs[] | "\(.name) \(.status) \(.conclusion)"'
```

That command prints three names. One of them is a failure.

The trigger causes the difference. `plan and apply` is the only job in the `deploy` workflow. That
workflow starts on a push to `main`. It also starts on a manual start. It does not start on a pull
request. GitHub keeps such a run out of the pull request summary. The run on this head commit
started as a manual start.

An absent check looks the same as a passing check. Read the check runs on the head commit. Do not
read the pull request summary.

## The commit status is empty, not green

The combined status endpoint answers `pending` with zero contexts on this head commit. It answers
the same on all thirteen heads. That is an absence. It is not a failure.

## No check is mandatory in this repository

I read three endpoints today:

- `repos/atlantic-blue/transcript/branches/main/protection` answers 404 with "Branch not protected".
- `repos/atlantic-blue/transcript/rulesets` answers with an empty list.
- `repos/atlantic-blue/transcript/rules/branches/main` answers with an empty list.

So no check is mandatory. No check blocks a merge.

I read the test as "a check that is not passing". I did not read it as "a check that a branch rule
makes mandatory". I name that judgement here, because it decides the answer. Under the strict
reading nothing is eligible, and a real red check on the oldest pull request stays hidden.

## The other twelve open pull requests

Each one is newer than pull request 4. Each one has two check runs, `code` and `infrastructure`.
Both pass on each one. None conflicts with `main`. So none qualifies.

- Number 5, `docs: name the pull request to land`, head `46b9460a`, opened 00:57 on 1 September. Adds `subject.md`.
- Number 6, `docs: the subject to land is pull request 4`, head `9597c60c`, opened 07:12. Adds `subject.md`.
- Number 7, `docs: name pull request 4 as the subject to land`, head `e44acfdb`, opened 07:13. Adds `subject.md`.
- Number 8, `docs: say what landing pull request 4 found`, head `c2878ae4`, opened 07:23. Adds `land.md`.
- Number 9, `docs: record pull request 4 as the subject to land`, head `d3ced9d9`, opened 07:33. Adds `docs/subject.md`.
- Number 10, `docs: record what landing pull request 4 found`, head `a258d485`, opened 07:44. Adds `docs/land.md`.
- Number 11, `docs: name pull request 4 as the subject to land`, head `b09ec2fc`, opened 07:51. Adds `docs/the-subject-to-land.md`.
- Number 12, `docs: record what landing pull request 4 found`, head `0a959240`, opened 07:58. Adds `docs/landing-pull-request-4.md`.
- Number 13, `docs: name pull request 4 as the subject to land`, head `f5f866f9`, opened 08:04. Adds `docs/subject-pull-request-4.md`.
- Number 14, `docs: record what landing pull request 4 found`, head `cd85b465`, opened 08:12. Adds `docs/land-pull-request-4-the-address-is-refused.md`.
- Number 15, `docs: the subject to land is pull request 4, red on plan and apply`, head `4ba306a0`, opened 08:20. Adds `docs/the-subject-is-pull-request-4.md`.
- Number 16, `docs: record what landing pull request 4 found`, head `0a694313`, opened 08:29. Adds `docs/land-pull-request-4-the-check-is-red-on-main.md`.

Pull requests 5, 6, 7, 9, 11, 13 and 15 are the output of earlier rounds of this same task. Each one
names pull request 4. Pull requests 8, 10, 12, 14 and 16 report the round that worked it.

## The exclusions I checked

- **Draft.** No pull request is a draft. `isDraft` is false on all thirteen.
- **A head branch that another pull request is based on.** Every `baseRefName` is `main`. No pull
  request is based on another pull request's head branch. So landing pull request 4 breaks no child.
- **Conflicts.** GitHub answers `MERGEABLE` and `CLEAN` for all thirteen. I did not trust that
  answer alone. I ran `git merge-tree --write-tree origin/main <head>` for each one. Each command
  exits 0. Each command prints no conflict line.

## A collision that is already there

Pull requests 5, 6 and 7 each add `subject.md` at the root of the repository. `main` holds no such
file, so none of the three conflicts with `main` today. The first of them to merge creates the file.
Then the other two conflict on add over add. A person must resolve them by hand.

The pull request that carries this report adds `docs/subject-4-the-oldest-with-a-red-check.md`. No
other open pull request touches that path. So it conflicts with none of the twelve.

## What landing pull request 4 will find

An earlier round worked pull request 4 to the end. Its report ships as pull request 10, 12, 14
and 16. The short version is below. I did not measure these readings again in this round.

- The branch needs no merge. `origin/main` at `3b5f6cc` is an ancestor of the head.
- Every gate that can run in a sandbox passes on the branch.
- The red step is a correct gate. It asks the deployed page for a transcript. The page answers 502.
- Every `deploy` run in this repository failed. The runs on `main` failed too. So pull request 4
  does not cause the failure. It inherits the failure.
- The cause is the address that the function calls from. The platform sends a bot check to Amazon
  Web Services Lambda in eu-west-1.

I verified the state that decides the pick. That state is the pull request list, the draft flag, the
base branch, the mergeability and the check runs on every head commit. I verified each one today.
