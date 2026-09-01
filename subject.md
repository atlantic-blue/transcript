# The pull request to land

Read on 1 September 2026, after `git fetch` and a live read of the GitHub interface.

## The subject

- Number: 4
- Address: https://github.com/atlantic-blue/transcript/pull/4
- Title: fix: report what the platform actually answered instead of a missing video
- Head branch: `diagnose-the-boundary-and-report-the-real-cause`
- Head commit: `84d9fe37c3414e82dc8937a7046a626cc590d8c0`
- Conflicts with main: no
- Checks that are not passing: `plan and apply`

## Why this one is eligible

It is the only open pull request. It is not a draft. No other pull request is based on its head
branch, so landing it breaks no child.

It does not conflict. GitHub reports the pull request as `MERGEABLE` with a merge state of
`CLEAN`. A local merge of `origin/main` into the head commit answers `Already up to date`, because
the head commit already contains the tip of `main`, which is `3b5f6cc`.

One check on the head commit is failing. That check is `plan and apply`, the only job of the
`deploy` workflow. The operator started that workflow by hand against this branch on 31 August
2026. The run is
https://github.com/atlantic-blue/transcript/actions/runs/33387270234 and the job is
https://github.com/atlantic-blue/transcript/actions/runs/33387270234/job/99472620061.

## Where the failing check hides

`gh pr checks 4` prints two checks, `code` and `infrastructure`, and both pass. It does not print
`plan and apply`, because that run came from a manual start and not from the pull request, so
GitHub keeps it out of the pull request summary. The failing check is visible only on the head
commit itself:

```
gh api repos/atlantic-blue/transcript/commits/84d9fe37c3414e82dc8937a7046a626cc590d8c0/check-runs \
  --jq '.check_runs[] | "\(.name) \(.conclusion)"'
```

That command answers:

```
plan and apply failure
infrastructure success
code success
```

An absent check reads the same as a passing one, so read the head commit and not only the pull
request summary.

## What the failing check says

The job deploys, then asks the deployed page for a transcript. It tried eight times over four
minutes. Every attempt answered 502. The last line of the job is:

```
the page answered 502 with 4777 bytes, and said: The platform refused this page, not your video
```

The 502 and that sentence are what this pull request adds. Before it, the same failure answered
404 and said the video did not exist. So the pull request does what its title says, and the
product still cannot read a transcript from the deployed function. The pull request body states
this too: the platform refuses the address the function calls from, at the watch page, with
`playability: LOGIN_REQUIRED`.

The deploy job failed on every run of this workflow, including runs against `main`
(runs 1, 2, 3 and 5). The failure is older than this branch.

## The other pull requests

Numbers 1, 2 and 3 are merged, so none of them is open. There are no other open pull requests and
no drafts.
