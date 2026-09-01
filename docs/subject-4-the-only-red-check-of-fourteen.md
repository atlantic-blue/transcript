# The pull request to land

I fetched first. Then I read. I read this on 1 September 2026 at 09:08 in Coordinated Universal
Time. `origin/main` is at `3b5f6cc2038dfd13b17fc55714b525be076336e4`.

Fourteen pull requests are open in `atlantic-blue/transcript`. They are the numbers 4 to 17.

## The subject

- Number: 4
- Address: https://github.com/atlantic-blue/transcript/pull/4
- Title: fix: report what the platform actually answered instead of a missing video
- Head branch: `diagnose-the-boundary-and-report-the-real-cause`
- Head commit: `9e819482aad60f86b7c085402545b1c49f7cfb53`
- Base branch: `main`
- Draft: no
- Conflicts with `main`: no
- Checks that are not passing: `plan and apply`

The head commit moved since yesterday. An earlier round pushed two commits to this branch. The head
was `84d9fe37` on 31 August. It is `9e819482` now. Read the checks on the new head.

## Why I picked this one

The test has three parts. A pull request qualifies on a conflict with `main`. It qualifies on a
failing check. It qualifies on both.

No open pull request conflicts with `main`. So the first part selects nothing.

Pull request 4 is the only one with a check that is not passing. It is also the oldest of the
fourteen. It opened on 31 August 2026 at 11:30. Every other pull request opened on 1 September 2026.

## The check that is not passing

`plan and apply` started at 09:01 and completed at 09:05 on 1 September 2026. Its conclusion is
failure. The job is here:

https://github.com/atlantic-blue/transcript/actions/runs/33490002826/job/99798994134

The job deploys the page. Then it asks the deployed page for a transcript. The page answered 502
eight times across four minutes. The last two lines of the job say this:

```
the page answered 502 with 4777 bytes, and said: The platform refused this page, not your video
##[error]the page answered 502 and said: The platform refused this page, not your video
```

The three check runs on the head commit are these:

- `code`: completed, success
- `infrastructure`: completed, success
- `plan and apply`: completed, failure

## The pull request summary hides that check

`gh pr checks 4` prints two lines. It prints `code`. It prints `infrastructure`. It calls both a
pass. It exits 0. It does not print `plan and apply`.

Read the head commit instead:

```
gh api repos/atlantic-blue/transcript/commits/9e819482aad60f86b7c085402545b1c49f7cfb53/check-runs \
  --jq '.check_runs[] | "\(.name) \(.status) \(.conclusion)"'
```

That command prints three names. One of them is a failure.

The trigger causes the difference. `plan and apply` is the only job in the `deploy` workflow. That
workflow starts on a push to `main`. It also starts on a manual start. It does not start on a pull
request. GitHub keeps such a run out of the pull request summary.

An absent check looks the same as a passing check. Read the check runs on the head commit. Do not
trust the pull request summary in this repository.

## The failure is older than the branch

Do not read the red check as damage that pull request 4 caused. Every run of the `deploy` workflow
in this repository failed. Nine runs exist. All nine failed. Three of them ran on `main`, and the
newest of those is run 33313972826 on commit `3b5f6cc2`.

The deploy job never passed here. Pull request 4 inherits the failure.

## No check is mandatory in this repository

I read three endpoints today:

- `repos/atlantic-blue/transcript/branches/main/protection` answers 404 with "Branch not protected".
- `repos/atlantic-blue/transcript/rulesets` answers with an empty list.
- The combined status endpoint answers `pending` with zero contexts on every head.

So no check is mandatory, and no check blocks a merge.

I read the test as "a check that is not passing". I did not read it as "a check that a branch rule
makes mandatory". I name that judgement here, because it decides the answer. Under the strict
reading nothing is eligible, and a real red check on the oldest pull request stays hidden.

## The exclusions I checked

**Draft.** No pull request is a draft. `isDraft` is false on all fourteen.

**A head branch that another pull request is based on.** Every `baseRefName` is `main`. No pull
request is based on another pull request's head branch. So landing pull request 4 breaks no child.

**Conflicts.** GitHub answers `MERGEABLE` and `CLEAN` for all fourteen. I did not trust that answer
alone. I ran `git merge-tree --write-tree origin/main <head>` for each one. Each command exits 0.
Each command prints no conflict line.

## The other thirteen open pull requests

Each one is newer than pull request 4. Each one carries two check runs, `code` and `infrastructure`.
Both pass on each one. None conflicts with `main`. So none qualifies.

- Number 5, `docs: name the pull request to land`, head `46b9460a`, opened 00:57. Adds `subject.md`.
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
- Number 17, `docs: name pull request 4 as the subject to land`, head `0279053a`, opened 08:36. Adds `docs/subject-4-the-oldest-with-a-red-check.md`.

Pull requests 5, 6, 7, 9, 11, 13, 15 and 17 are the output of earlier rounds of this same task. Each
one names pull request 4. Pull requests 8, 10, 12, 14 and 16 report the round that worked it.

## A collision that is already there

Pull requests 5, 6 and 7 each add `subject.md` at the root of the repository. `main` holds no such
file, so none of the three conflicts with `main` today. The first of them to merge creates the file.
Then the other two conflict on add over add. A person must resolve them by hand.

The pull request that carries this report adds `docs/subject-4-the-only-red-check-of-fourteen.md`.
I read the file list of all fourteen open pull requests. No other one touches that path. So it
conflicts with none of them.

## What an earlier round already found on pull request 4

One earlier round worked pull request 4 to the end. Its report ships as pull requests 10, 12, 14 and
16. I did not measure these readings again. Read them as context, not as facts I verified today.

- The branch needs no merge. `origin/main` at `3b5f6cc2` is an ancestor of the head.
- Every gate that runs in a sandbox passes on the branch. The suite is 127 tests.
- The red step is a correct gate. It asks the deployed page for a transcript and does not get one.
- The platform refuses the deployed function at the watch page. The reason is a bot check.
- The block is on the address the function calls from. It is not the client the request claims to be.
- The fix needs an egress address that the platform accepts. Every option for that bills while
  nobody visits, and `CLAUDE.md` refuses those by name. A person must decide.

## What I verified today

I verified the state that decides the pick. That state is the list of open pull requests, the draft
flag, the base branch, the mergeability and the check runs on every head commit. I read each one on
1 September 2026.
