# Landing pull request 4

https://github.com/atlantic-blue/transcript/pull/4

Title: fix: report what the platform actually answered instead of a missing video

Branch: `diagnose-the-boundary-and-report-the-real-cause`

Head before: `84d9fe3`. Head after: `84d9fe3`.

I read this repository on 1 September 2026. I fetched first. Then I read.

## What I resolved

Nothing. There was no conflict.

`origin/main` is at `3b5f6cc`. Git reports that commit as an ancestor of the branch head. So
`git merge origin/main` answered "Already up to date". The merge wrote no commit. The merge changed
no file. I did not rebase. I did not force push.

I pushed the branch. Git answered "Everything up-to-date". The working tree is clean. GitHub reports
the pull request as mergeable against `main`.

## What I fixed

Nothing in the code. I changed no file on the branch of pull request 4.

I ran every gate that can run here. I ran each gate as one command. I read each result before I ran
the next command. I sent no gate into `tail` or `grep`, so each exit code is the exit code of the
gate and not of a filter.

```
npm ci                                    exit 0
npm run typecheck                         exit 0
npm run lint                              exit 0
npm run test:count                        exit 0   tests: 114 total, 114 passed, 0 failed
npm run build                             exit 0   bundle 7.13 MB, worker 1641 bytes
TABLE_NAME=unused npm run verify:package  exit 0   GET / answered 200 with 4697 bytes
terraform fmt -check -recursive           exit 0
terraform init -backend=false             exit 0
terraform validate                        exit 0   Success
```

## The check that is red

The failing check is `plan and apply`. It belongs to the `deploy` workflow.

That workflow starts on a push to `main`. It also starts on a manual start. It does not start on a
pull request. So `gh pr checks 4` prints two checks and exits 0. It does not print this one. Read
the commit instead:

```
gh api repos/atlantic-blue/transcript/commits/84d9fe37/check-runs \
  --jq '.check_runs[] | "\(.name) \(.conclusion)"'

plan and apply   failure
infrastructure   success
code             success
```

The failing job is here:

https://github.com/atlantic-blue/transcript/actions/runs/33387270234/job/99472620061

`gh run view --log-failed` answered with an empty file. I read the log through the interface
instead, with `gh api repos/atlantic-blue/transcript/actions/jobs/99472620061/logs`.

## What the log says

The deploy worked. Terraform planned. Terraform applied. The function address answered 200. The
front page answered 200.

The job failed on its last step. That step asks the deployed page for a transcript. The page
answered 502 eight times over four minutes:

```
attempt 1 answered 502, the distribution may still be spreading
... eight attempts, thirty seconds apart ...
the page answered 502 with 4777 bytes, and said:
  The platform refused this page, not your video
```

## I confirmed the cause against the running system

I took three readings on 1 September 2026. I did not take them from the code.

1. The deployed page. `https://dm60tfc2fh2e6.cloudfront.net/videos?id=gyN9lV9QgyA` answered 502
   with 4777 bytes. Its title is "The platform refused this page, not your video".

2. The function log. Log group `/aws/lambda/transcript-handler` in eu-west-1, at
   2026-09-01T08:08:54.683Z. My own request made that line, one second earlier:

```
{"event":"watch_page_unreadable","video_id":"gyN9lV9QgyA","cause":"bot_check",
 "status":200,"bytes":1313601,"has_video_details":true,"has_caption_tracks":false,
 "has_player_response":true,"playability":"LOGIN_REQUIRED",
 "playability_reason":"Sign in to confirm you are not a bot",
 "markers":["not a bot","consent","sign in"]}
```

   The platform answers 200. It sends a bot check. It sends no caption tracks.

3. The same code, run from this sandbox. `npm run test:live` exited 0. It read 280 caption segments
   and 19141 characters from video `gyN9lV9QgyA`.

Reading 3 against reading 2 is the diagnosis. One code base. Two addresses. Two answers. The code is
not the fault. The address the function calls from is the fault.

## The failure comes from `main`

Every `deploy` run in this repository failed. The runs on `main` failed too.

```
33387270234  diagnose-the-boundary-and-report-the-real-cause  84d9fe37  failure
33386170462  diagnose-the-boundary-and-report-the-real-cause  9f98ba0c  failure
33313972826  main                                             3b5f6cc2  failure
33313802106  fix-the-function-url-answers-instead-of-403      19004078  failure
33312928308  main                                             75b62fb2  failure
33312819570  main                                             75b62fb2  failure
33311209287  main                                             e61e38df  failure
```

I read the log of run 33313972826. That run is `main` at `3b5f6cc`, which is the base of pull
request 4. It failed on the same step. It answered 404 eight times.

Before this pull request the page called a refusal a missing video. After this pull request the page
answers 502 and names the refusal. The check is still red. It is now red about the right thing.

So pull request 4 does not cause this failure. It inherits it.

## Why I changed nothing

- The failing step is a correct gate. It asks the deployed page for a transcript. It fails when it
  does not get one. To make it pass I must weaken it, and the product stays broken.
- To pass the bot check, the function needs a different address to call from. Each way to get one
  bills money while nobody visits: a network address translation gateway, an always on proxy, or a
  paid proxy service. The project context refuses the first two by name. It says what to do instead:
  do not build it, say so in the answer, and let a person decide.
- I cannot test a fix from here. The platform accepts this sandbox, so a change made here passes for
  the wrong reason. The only place to test it is a real deploy, and a deploy from a sandbox is not
  allowed.
- A new way to fetch is a second intention. This pull request reports the real cause. How the
  function reaches the platform belongs in its own pull request, with its own evidence.

## What a person decides next

The product cannot read a transcript from Amazon Web Services Lambda in eu-west-1. The platform
refuses that address. Somebody must choose one of these. Each one costs money while nobody visits:

- a network address translation gateway, so the function calls from an accepted address;
- a paid proxy service;
- an always on host outside Amazon Web Services.

The project context refuses the first by name. It refuses always on hosts by name. So this is a
decision, not a task to build.

## The run this report started

The push to pull request 4 started no run. The merge moved nothing, and the `deploy` workflow does
not start on a pull request.

This file ships in its own pull request, cut from `origin/main` at `3b5f6cc`.
