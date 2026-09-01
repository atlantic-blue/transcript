# Landing pull request 4

Subject: https://github.com/atlantic-blue/transcript/pull/4

Title: `fix: report what the platform actually answered instead of a missing video`

Head branch: `diagnose-the-boundary-and-report-the-real-cause`. Head commit `9e819482`.

I worked it on 1 September 2026.

## What I resolved

Nothing. The branch needs no merge.

`origin/main` is at `3b5f6cc2038dfd13b17fc55714b525be076336e4`. That commit is an ancestor of the
head. `git merge origin/main` answers "Already up to date". No conflict exists. The pull request
still means what it meant, because no file changed.

## What I fixed

Nothing on the branch. The branch is correct. One check fails, and the fix for it needs a decision
about money. That decision belongs to a person.

## The gates I ran, and what each one answered

I ran each command on its own. I wrote its output to a file. I read its own exit status before I
ran the next one. I put no gate through `tail` or `grep`.

- `npm run typecheck`, exit 0.
- `npm run lint`, exit 0.
- `npm run test:count`, exit 0. It reports 127 tests total, 127 passed, 0 failed.
- `npm run build`, exit 0. The bundle is 7.14 megabytes.
- `TABLE_NAME=unused npm run verify:package`, exit 0. The package starts and serves.
- `terraform fmt -check -recursive`, exit 0.
- `terraform validate`, exit 0.

## The check that fails

The name is `plan and apply`. It is the only job in the `deploy` workflow. The failing run is here:

https://github.com/atlantic-blue/transcript/actions/runs/33490002826/job/99798994134

Fourteen steps pass. The function address answers 200. The front page answers 200 with 4,697 bytes.
Step 15 asks the deployed page for a transcript. The page answered 502 eight times over four
minutes. The last two lines of the job are these:

```
the page answered 502 with 4777 bytes, and said: The platform refused this page, not your video
##[error]the page answered 502 and said: The platform refused this page, not your video
```

The pull request summary hides this job. The `deploy` workflow starts on a push to `main` and on a
manual start. It does not start on a pull request. So `gh pr checks 4` prints two names and exits
0. Read the check runs on the head commit instead. An absent check looks the same as a passing
check.

## The cause, read live today

I read the function log in `eu-west-1` today, at 09:33 in Coordinated Universal Time. The log group
is `/aws/lambda/transcript-handler`. Each of the eight requests wrote the same two lines:

```
{"event":"watch_page_unreadable","video_id":"gyN9lV9QgyA","cause":"bot_check",
 "status":200,"bytes":1333519,"has_video_details":true,"has_caption_tracks":false,
 "has_player_response":true,"playability":"LOGIN_REQUIRED",
 "playability_reason":"Sign in to confirm you're not a bot","markers":["not a bot","consent","sign in"]}
{"event":"player_unusable","video_id":"gyN9lV9QgyA",
 "reason":"the player endpoint did not return a playable video","status":200,
 "playability":"LOGIN_REQUIRED","playability_reason":"Sign in to confirm you're not a bot"}
```

The platform refuses both entry points. It asks the caller to sign in to prove it is not a machine.
The refusal is a property of the address the function calls from. It is not a defect in the code.

## The failure is older than the branch

Nine runs of the `deploy` workflow exist. All nine failed. Run 33313972826 ran on `main` at commit
`3b5f6cc2`, before this branch existed. Its step 14, `read the page that is now serving`, failed.
That is the same product step under its earlier name.

So pull request 4 inherits this failure. The branch did not cause it.

## The code reads the text from an address the platform accepts

I ran `npm run test:live` in this sandbox today. It exits 0 and two tests pass. The readings on
video `gyN9lV9QgyA`:

- The watch page path reads 560 segments and 19,420 characters.
- With the watch page refused by a double, the player path reads the same 560 segments and the same
  19,420 characters.
- A video with no captions answers 200 and stores `has_captions` false.
- A video that does not exist answers 404. A malformed id answers 400.
- A second visit costs no fetch. The count stays at 3.

Captured from a run of `npm run test:live` in this sandbox on 1 September 2026. To reproduce it you
need an address the platform accepts. This sandbox is one. The deployed function is not.

The same code reads the text from one address and gets refused at the other.

## Why I did not fix it

The function must reach the platform from an address the platform accepts. I found three ways to do
that. Each one spends money, or it stores a credential:

- A network address translation gateway with a fixed address. It bills while nobody visits.
  `CLAUDE.md` refuses it by name.
- A proxy service. It is a paid dependency.
- Stored account cookies for the platform. Those are the credential of a person. That is a policy
  choice.

`CLAUDE.md` gives the instruction for this case. If the work seems to need something on the refused
list, do not build it, say so, and stop. A person decides.

I did not weaken the gate. The gate is correct. It asks the deployed page for a transcript, and it
does not get one. I deleted no assertion. I lowered no threshold.

I did not guess either. Two clients are measured, and the platform refuses both. The web client is
refused at the watch page. The iOS client is refused at the player endpoint. I cannot test a third
client from this sandbox, because the platform does not refuse this sandbox. To try one I must
deploy it and watch it, and that is a guess and not a diagnosis.

## What a person must decide

Name the egress to buy. The check can pass after that. The code behind it already works.
