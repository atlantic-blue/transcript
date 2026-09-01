# Subject

Repository: `atlantic-blue/transcript`. I fetched before I read. `origin/main` is at `3b5f6cc`.

## The pull request to land

- Number: 4
- Title: fix: report what the platform actually answered instead of a missing video
- Head branch: `diagnose-the-boundary-and-report-the-real-cause`
- Head commit: `84d9fe37c3414e82dc8937a7046a626cc590d8c0`
- Base branch: `main`
- Conflicts with main: no
- Checks that are not passing: `plan and apply`

It is the older of the two open pull requests. One check on its head commit failed. It qualifies on
the failing check alone.

## The failing check is hidden from the usual command

`gh pr checks 4` prints two checks, `code` and `infrastructure`. It says both pass, and it exits 0.
It does not print `plan and apply`. The pull request summary agrees: the check list holds two names.

The check is on the commit. Read the commit to see it:

```
gh api repos/atlantic-blue/transcript/commits/84d9fe37/check-runs \
  --jq '.check_runs[] | "\(.name) \(.conclusion)"'
```

That answers with three names. `plan and apply` is `failure`.

The trigger is the reason. The `deploy` workflow runs on a push to `main` and on a manual start. It
does not run on a pull request. Run 33387270234 was started by hand on the branch, so GitHub keeps
it out of the pull request summary. An absent check reads the same as a passing one.

https://github.com/atlantic-blue/transcript/actions/runs/33387270234/job/99472620061

## What the failing check says

The deploy applied. The last step opened the page and read it. The page answered 502 eight times
over four minutes. The body said "The platform refused this page, not your video".

## This pull request does not cause the failure

Every `deploy` run in this repository failed, on `main` as well as on this branch. The runs on
`main` at `3b5f6cc`, `75b62fb` and `e61e38d` all failed.

The pull request says why. The platform refuses the address the function calls from. It refuses
with a bot check, at the watch page, before the proof of origin work starts. The pull request makes
the page report that cause. Before it, the page answered 404 and said the video was missing.

The pull request description states that the deploy check stays red while the product cannot read a
transcript. So do not expect `plan and apply` to go green when you land this. Getting the caption
text is the open problem the project context already names.

## The repository has no required checks

`repos/atlantic-blue/transcript/branches/main/protection` answers 404, "Branch not protected". The
ruleset list is empty. No check is required and no check blocks a merge. `plan and apply` is a check
that failed, not a gate.

## The other open pull request, and why I did not pick it

- Number: 5
- Title: docs: name the pull request to land
- Head branch: `docs-name-the-pull-request-to-land`
- Head commit: `46b9460a1d60528647fa19f8f691d36ee9155c07`
- Conflicts with main: no
- Checks that are not passing: none

It is newer than 4. It does not conflict, and no check on it failed. So it does not qualify. It
carries two check runs, `code` and `infrastructure`. Both passed. The `deploy` workflow never ran on
its head commit.

Pull request 5 is the output of an earlier round of this same task, and its `subject.md` also names
pull request 4. It is still open. Both files add `subject.md` at the root, so whichever one merges
second will conflict with the first.

## The exclusions I checked

- Neither pull request is a draft. `draft` is false on both.
- Both target `main`. Both come from this repository, not a fork. So neither head branch is the base
  of the other, and landing 4 breaks no child.
- Neither conflicts. `git merge-tree --write-tree origin/main <head>` exits 0 for both and reports no
  conflict. I ran this locally because GitHub answered `mergeable=null` on a later read, which is the
  value it gives while it recomputes.
- There are only two open pull requests. `repos/atlantic-blue/transcript/pulls?state=open` returns a
  list of length 2.

## What I did not do

I changed nothing in pull request 4 and nothing on `main`. This step reads and records.
