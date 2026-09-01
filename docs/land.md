# Landing pull request 4

https://github.com/atlantic-blue/transcript/pull/4

Title: fix: report what the platform actually answered instead of a missing video
Branch: `diagnose-the-boundary-and-report-the-real-cause`
Head before: `84d9fe3`
Head after: `84d9fe3`

## What I resolved

Nothing. There was no conflict.

`origin/main` is at `3b5f6cc`. That commit is already the base of the branch. So
`git merge origin/main` answered "Already up to date". The merge wrote no commit and changed no
file. I did not rebase. I did not force push.

I pushed the branch. Git answered "Everything up-to-date", because the merge moved nothing. A push
that moves nothing starts no run, so this push has no run address. GitHub reports the branch as
`MERGEABLE` and `CLEAN` against `main`.

## What I fixed

Nothing in the code. I changed no file on the branch.

Every gate that can pass, passes. I ran each gate as one command. I read each result before I ran
the next one. I sent no gate through `tail` or `grep`, so each exit code is the gate's own.

    npm ci                                exit 0
    npm run typecheck                     exit 0
    npm run lint                          exit 0
    npm run test:count                    exit 0   tests: 114 total, 114 passed, 0 failed
    npm run build                         exit 0   bundle 7.13 MB, worker 1641 bytes
    TABLE_NAME=unused npm run verify:package  exit 0   GET / answered 200 with 4697 bytes
    terraform fmt -check -recursive       exit 0
    terraform init -backend=false         exit 0
    terraform validate                    exit 0   Success

## The check that stays red, and why I changed nothing

The failing check is `plan and apply`. It is the `deploy` workflow. That workflow starts on a push
to `main` and on a manual start. It does not start on a pull request. So `gh pr checks 4` does not
print it, and the pull request summary does not print it. The check is on the commit:

    gh api repos/atlantic-blue/transcript/commits/84d9fe37/check-runs \
      --jq '.check_runs[] | "\(.name) \(.conclusion)"'

    plan and apply   failure
    infrastructure   success
    code             success

https://github.com/atlantic-blue/transcript/actions/runs/33387270234/job/99472620061

`gh run view --log-failed` answered with an empty file for that run. I read the log through the
API instead, with `gh api repos/atlantic-blue/transcript/actions/jobs/99472620061/logs`.

The deploy itself worked. The plan applied, the function url answered 200, and the front page
answered 200 with 4697 bytes. One step failed, and it is the last one. It asks the deployed page
for a transcript:

    attempt 1 answered 502, the distribution may still be spreading
    ... eight attempts over four minutes ...
    the page answered 502 with 4777 bytes, and said:
      The platform refused this page, not your video

## I confirmed the cause against the running system, not from the code

Three readings, all taken on 1 September 2026.

1. The deployed page. `https://dm60tfc2fh2e6.cloudfront.net/videos?id=gyN9lV9QgyA` answered 502
   with 4777 bytes. Its title is "The platform refused this page, not your video".

2. The function log. Log group `/aws/lambda/transcript-handler` in eu-west-1, at
   2026-09-01T07:42:28.074Z:

       {"event":"watch_page_unreadable","video_id":"gyN9lV9QgyA","cause":"bot_check",
        "status":200,"bytes":1333408,"has_video_details":true,"has_caption_tracks":false,
        "has_player_response":true,"playability":"LOGIN_REQUIRED",
        "playability_reason":"Sign in to confirm you are not a bot",
        "markers":["not a bot","consent","sign in"]}

   The platform answers 200 and sends a bot check. It sends no caption tracks.

3. The same code, run from this sandbox. `npm run test:live` passed. It read 560 caption segments
   and 18861 characters from video `gyN9lV9QgyA`.

Reading 3 against reading 2 is the whole diagnosis. One code base, two addresses, two answers. So
the code is not the fault. The address the function calls from is the fault.

The failure is inherited from `main`, not caused by this pull request. Every `deploy` run in this
repository failed, on `main` as well as on this branch. The run on `main` at `3b5f6cc` failed on
the same step. It answered 404 eight times, because before this pull request the page called a
refusal a missing video. After this pull request the page answers 502 and names the refusal. The
check is still red, and now it is red about the right thing.

I changed nothing, for four reasons.

- The failing step is a correct gate. It asks the deployed page for a transcript, and it fails when
  it does not get one. To make it pass I must weaken it, and the product would still be broken.
- Getting past the bot check needs a different address to call from. Every way to get one bills
  while nobody visits: a network address translation gateway, an always on proxy, or a paid proxy
  service. The project context refuses each one by name, and it says what to do instead: do not
  build it, say so in the answer, and let a person decide.
- I cannot test a fix from here. This sandbox is not refused, so any change made here passes for
  the wrong reason. The only place to test it is a real deploy, and a deploy from a sandbox is not
  allowed.
- A new way to fetch is a second intention. This pull request reports the real cause. Changing how
  the function reaches the platform belongs in its own pull request, with its own evidence.

## What a person decides next

The product cannot read a transcript from AWS Lambda in eu-west-1. The platform refuses that
address. To fix it, somebody must choose one of these, and each one costs money while nobody
visits:

- a network address translation gateway, so the function calls from an address the platform
  accepts;
- a paid proxy service;
- an always on host outside AWS.

The project context refuses the first by name, and refuses always on hosts by name. So this is a
decision, not a task to build.

## The run this report started

This file ships in its own pull request, cut from `origin/main` at `3b5f6cc`:

https://github.com/atlantic-blue/transcript/pull/10

The push to that branch started this run, and it passed:

https://github.com/atlantic-blue/transcript/actions/runs/33483614508

I read the log rather than the colour. The `code` job installed 246 packages, printed
"tests: 75 total, 75 passed, 0 failed", built a 7.13 MB bundle and printed "the package starts and
serves". The `infrastructure` job checked the format and validated the configuration. Both jobs
report success, and both check runs on the head commit report success.

The push to pull request 4 itself started no run, because the merge moved nothing and the `deploy`
workflow does not start on a pull request.
