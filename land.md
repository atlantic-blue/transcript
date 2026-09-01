# Landing pull request 4

https://github.com/atlantic-blue/transcript/pull/4

Title: fix: report what the platform actually answered instead of a missing video
Branch: `diagnose-the-boundary-and-report-the-real-cause`
Head before: `84d9fe3`
Head after: `84d9fe3`

## What I resolved

Nothing. There was no conflict to resolve.

`origin/main` is at `3b5f6cc`. That commit is already the base of the branch. So
`git merge origin/main` answered "Already up to date". The merge made no commit and changed no
file. I did not rebase. I did not force push.

I pushed the branch. Git answered "Everything up-to-date", because the merge moved nothing.

## What I fixed

Nothing in the code. I changed no file on the branch.

Every check that can pass, passes. I ran each gate on the branch, one command at a time, and I read
each result before I ran the next one. I sent no gate through `tail` or `grep`.

    npm ci                              exit 0
    npm run typecheck                   exit 0
    npm run lint                        exit 0
    npm run test:count                  exit 0   114 tests total, 114 passed
    npm run build                       exit 0   bundle 7.13 MB, worker 1641 bytes
    TABLE_NAME=unused verify:package    exit 0   GET / answered 200 with 4697 bytes
    terraform fmt -check -recursive     exit 0
    terraform validate                  exit 0   Success

I also ran `npm run test:live`, which is not a gate. It reads the real platform. It passed, and it
read 560 caption segments and 18861 characters from video `gyN9lV9QgyA`.

## The check that stays red, and why I changed nothing

The failing check is `plan and apply`. It is the `deploy` workflow. It does not run on a pull
request, so `gh pr checks 4` does not show it. It is on the commit.

https://github.com/atlantic-blue/transcript/actions/runs/33387270234/job/99472620061

I read that log. The deploy itself worked:

    Plan: 0 to add, 1 to change, 0 to destroy.
    Apply complete! Resources: 0 added, 1 changed, 0 destroyed.
    the function url answered 200
    the front page answered 200 with 4697 bytes

One step failed. It is the last one. It asks the deployed page for a transcript:

    attempt 1 answered 502, the distribution may still be spreading
    ... eight attempts over four minutes ...
    the page answered 502 with 4777 bytes, and said:
      The platform refused this page, not your video

The cause is a refusal at the platform, and it lands on the address the function calls from.

I confirmed the cause against the running system. I did not read it from the code alone.

1. The function's own log in eu-west-1, log group `/aws/lambda/transcript-handler`, at
   2026-08-31T15:14:18.090Z:

       {"event":"watch_page_unreadable","video_id":"gyN9lV9QgyA","cause":"bot_check",
        "status":200,"bytes":1388803,"has_video_details":true,"has_caption_tracks":false,
        "playability":"LOGIN_REQUIRED",
        "playability_reason":"Sign in to confirm you are not a bot"}

2. I read the deployed page today, 1 September 2026. It answered 502 with 4777 bytes. Its title is
   "The platform refused this page, not your video".

3. The same code, from this sandbox, reads the video. The live suite got 560 segments. So the code
   is not the problem. The address the function calls from is the problem.

Every `deploy` run in this repository failed, on `main` as well as on this branch. The run on `main`
at `3b5f6cc` failed on the same step. It answered 404 eight times. This is the exact defect the
pull request fixes: the page called a refusal a missing video. After the pull request the page
answers 502 and names the refusal. The check is still red, and it is red about the right thing.

I changed nothing, for three reasons.

- The failing step is a correct gate. It asks the deployed page for a transcript, and it fails when
  it does not get one. Making it pass means weakening it, and the product would still be broken.
- Getting past the refusal needs a different address to call from. Every way to get one bills while
  nobody visits: a network address translation gateway, an always on proxy, or a paid proxy service.
  The project context refuses each one by name. It also says what to do: do not build it, say so,
  and let a person decide. So I stopped here.
- I cannot test a fix. This sandbox is not refused by the platform, so a change made here would be a
  guess. The only place to test it is a real deploy, and a deploy from a sandbox is not allowed.

The pull request description already states that this check stays red while the product cannot read
a transcript. Landing the pull request does not turn it green, and it was never going to.

## The run my push started

The push to `diagnose-the-boundary-and-report-the-real-cause` moved nothing, so it started no run.
The two checks on the head commit `84d9fe3` are `code` and `infrastructure`. Both pass. I ran the
same gates locally, and they pass here too.

This file ships in its own pull request, off the latest `origin/main`. That push started this run:

    https://github.com/atlantic-blue/transcript/actions/runs/33481941853

It passed. The `code` job ran 75 tests, built the bundle and started the package. The
`infrastructure` job checked the format and validated the configuration. Both are green, and I read
the log rather than the colour: the run installed 246 packages and printed
"tests: 75 total, 75 passed, 0 failed".

The pull request that carries this file is https://github.com/atlantic-blue/transcript/pull/8

## What a person decides next

The product cannot read a transcript from Amazon Web Services Lambda. The platform refuses that
address. To fix it, somebody must choose one of these, and each one costs money while nobody visits:

- a network address translation gateway, so the function calls from an address the platform accepts;
- a paid proxy service;
- an always on host outside Amazon Web Services.

Two of these are refused by name in the project context. So this is a decision, not a task.
