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

I pushed the branch. Git answered "Everything up-to-date". `git status --porcelain` printed nothing.
The local head and the remote head are the same commit.

## What I fixed

Nothing. I changed no file on the branch of pull request 4.

The reason is below. In short: the red check is a correct product gate, the product it tests is
broken on `main` as well as on this branch, and the fix is a decision about money that the project
context tells me to hand to a person.

## The gates I ran here

I ran each gate as one command. I read each result before I ran the next command. I sent no gate
into `tail` or `grep`, so each exit code is the exit code of the gate and not of a filter.

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

The failing check is `plan and apply`. It is the only job in the `deploy` workflow.

That workflow starts on a push to `main`. It also starts on a manual start. It does not start on a
pull request. So `gh pr checks 4` prints two checks and exits 0. It does not print this one. An
absent check reads the same as a passing one. Read the commit instead:

```
gh api repos/atlantic-blue/transcript/commits/84d9fe37/check-runs \
  --jq '.check_runs[] | "\(.name) \(.status) \(.conclusion)"'

plan and apply   completed failure
infrastructure   completed success
code             completed success
```

The failing job is here:

https://github.com/atlantic-blue/transcript/actions/runs/33387270234/job/99472620061

`gh run view --log-failed` answers with an empty file for this run. I read the log through the
interface instead, with `gh api repos/atlantic-blue/transcript/actions/jobs/99472620061/logs`.

## What the log says

The deploy worked. Terraform planned. Terraform applied. Then three steps asked the running system
questions. Two passed:

```
the function url answered 200
the front page answered 200 with 4697 bytes
```

The job failed on the last step. That step asks the deployed page for a transcript. The page
answered 502 eight times over four minutes:

```
attempt 1 answered 502, the distribution may still be spreading
... eight attempts, thirty seconds apart ...
the page answered 502 with 4777 bytes, and said: The platform refused this page, not your video
##[error]the page answered 502 and said: The platform refused this page, not your video
```

## I confirmed the cause against the running system

The log names the symptom. It does not name the cause. I took three readings today, 1 September
2026, to get the cause. I took them from the running system, not from the code.

1. The deployed page, now. `https://dm60tfc2fh2e6.cloudfront.net/videos?id=gyN9lV9QgyA` answered
   502 with 4777 bytes. Its title is "The platform refused this page, not your video". So the
   failure is not stale and not transient.

2. The function log, now. Log group `/aws/lambda/transcript-handler` in eu-west-1, stream
   `2026/09/01/[$LATEST]d6756fe8d08c49d6bcb9187a543429ee`, at 2026-09-01T08:25:46.471Z. My own
   request in reading 1 made that line:

```
{"event":"watch_page_unreadable","video_id":"gyN9lV9QgyA","cause":"bot_check",
 "status":200,"bytes":1349122,"has_video_details":true,"has_caption_tracks":false,
 "has_player_response":true,"playability":"LOGIN_REQUIRED",
 "playability_reason":"Sign in to confirm you’re not a bot",
 "markers":["not a bot","consent","sign in"]}
```

   The platform answers 200. It sends a bot check. It sends no caption tracks.

3. The same code, run from this sandbox. `npm run test:live` exited 0 in 5.00 seconds. It read the
   watch page at 1472153 bytes with caption tracks present, then 560 caption segments and 18861
   characters from the same video `gyN9lV9QgyA`.

Reading 3 against reading 2 is the diagnosis. One code base. Two addresses. Two answers. The code is
not the fault. The address the function calls from is the fault.

## The failure comes from `main`

Every `deploy` run this repository ever made failed. The runs on `main` failed too.

```
33387270234  workflow_dispatch  diagnose-the-boundary-...  84d9fe37  failure
33386170462  workflow_dispatch  diagnose-the-boundary-...  9f98ba0c  failure
33313972826  push               main                       3b5f6cc2  failure
33313802106  workflow_dispatch  fix-the-function-url-...   19004078  failure
33312928308  workflow_dispatch  main                       75b62fb2  failure
33312819570  push               main                       75b62fb2  failure
33311209287  push               main                       e61e38df  failure
```

Run 33313972826 is `main` at `3b5f6cc`, which is the base of pull request 4. It failed on the same
step. Before this pull request the page called a refusal a missing video, and the step read 404.
After this pull request the page answers 502 and names the refusal.

So pull request 4 does not cause this failure. It inherits it. The pull request does what its title
says, and the check is now red about the right thing.

## Why I changed nothing

Four reasons, in order of weight.

1. The failing step is a correct gate. It asks the deployed page for a transcript. It fails when it
   does not get one. The only way to make it pass from inside this pull request is to weaken it, and
   then the product stays broken while the board goes green.

2. The fix is not in this pull request. The check is red on `main` at the same step. A fix belongs
   in its own pull request off `main`, with one intention, so everybody is unblocked.

3. The fix needs a decision about money. To pass the bot check the function needs an address the
   platform accepts. `infra/function.tf` already carries the reason it has none, in a comment above
   the function: a function in a private subnet needs a network address translation gateway, and
   that gateway charges by the hour whether anybody reads a page or not. The project context refuses
   that gateway by name. It refuses an always on host by name. A paid proxy service is the third
   option and it also bills. The project context says what to do here: do not build it, say so in
   the answer, and let a person decide.

4. I cannot test the other candidate here. The other candidate is a code change: ask the platform's
   player interface with a proof of origin token bound to the visitor identity, instead of reading
   the watch page. The repository already mints such a token for the caption endpoint, so the change
   is small. I did not write it and I did not try it, and I want to be plain about why. This sandbox
   has an address the platform accepts, so any fetch change I make passes here for the wrong reason.
   The only place that answers the real question is a deployed function, and reaching it means
   applying an unproved change to the live product. That is a guess with a deploy attached, and a
   guess is what this job forbids.

## What a person decides next

The product cannot read a transcript from Amazon Web Services Lambda in eu-west-1. The platform
refuses that address. Two paths are open, and they are not equal.

- Change the address. A network address translation gateway, a paid proxy service, or an always on
  host outside Amazon Web Services. Each one bills while nobody visits. The project context refuses
  the first and the third by name.
- Change the request. Ask the player interface with a proof of origin token bound to the visitor
  identity. This costs nothing while nobody visits. It is unproved from a datacenter address, and
  the only way to prove it is a deploy.

I did not choose between them, because the first is refused by the project context and the second
needs a deploy to test.

## The run this report started

The push to pull request 4 started no run. The merge moved nothing, and the `deploy` workflow does
not start on a pull request. No new check run exists on `84d9fe37`, so `plan and apply` there is
still the failure from 31 August.

This file ships in its own pull request, cut fresh from `origin/main` at `3b5f6cc`.

The push that opened it started this run, and it passed:

https://github.com/atlantic-blue/transcript/actions/runs/33487276698

I read the log, not the colour. The `code` job printed "tests: 75 total, 75 passed, 0 failed". It
built a 7.13 MB bundle and a 1641 byte worker. It started the package, answered `GET /` with 200 and
4697 bytes, and printed "the package starts and serves". The count is 75 because this branch comes
from `main`. The 114 tests are on the branch of pull request 4. The `infrastructure` job checked the
format, initialised without a backend, and printed "Success! The configuration is valid."

GitHub reports the commit on this pull request as verified.

## The pull request that carries this report

https://github.com/atlantic-blue/transcript/pull/16
