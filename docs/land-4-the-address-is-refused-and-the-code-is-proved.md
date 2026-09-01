# Landing pull request 4

Pull request 4 is `fix: report what the platform actually answered instead of a missing video`.

- Address: https://github.com/atlantic-blue/transcript/pull/4
- Head branch: `diagnose-the-boundary-and-report-the-real-cause`
- Head commit: `9e819482aad60f86b7c085402545b1c49f7cfb53`

I worked it on 1 September 2026.

## What I resolved

Nothing. The branch needs no merge.

`origin/main` is at `3b5f6cc2038dfd13b17fc55714b525be076336e4`. That commit is an ancestor of the
head. `git merge origin/main` answers "Already up to date". No file conflicts. The pull request
still means what it meant, because nothing changed it.

## What I fixed

Nothing on the branch. The branch is correct. Every gate that a sandbox can run is green. The one
check that fails needs a decision about money, and that decision is not mine to make.

I ran each gate and I read each result before the next command:

- `npm run typecheck`, exit 0.
- `npm run lint`, exit 0.
- `npm run test:count`, exit 0. It reports 127 tests total, 127 passed, 0 failed.
- `npm run build`, exit 0. The bundle is 7.14 MB.
- `TABLE_NAME=unused npm run verify:package`, exit 0. The package starts and serves.
- `terraform fmt -check -recursive`, exit 0.
- `terraform validate`, exit 0.

I ran no gate through `tail` or `grep`. Each command wrote to a file and I read its own exit status.

## The check that is not passing

The check is `plan and apply`. It is the only job in the `deploy` workflow. The failing run is here:

https://github.com/atlantic-blue/transcript/actions/runs/33490002826/job/99798994134

That workflow starts on a push to `main` and on a manual start. It does not start on a pull
request, so GitHub keeps the run out of the pull request summary. `gh pr checks 4` prints two names
and exits 0. Read the check runs on the head commit instead. An absent check looks the same as a
passing check.

The job deploys the page. Every step passes up to the last one. The function address answers 200.
The front page answers 200 with 4,697 bytes. Then the job asks the deployed page for a transcript.
The page answered 502 eight times across four minutes. The last two lines of the job say this:

    the page answered 502 with 4777 bytes, and said: The platform refused this page, not your video
    ##[error]the page answered 502 and said: The platform refused this page, not your video

## The failure is older than the branch

Nine runs of the `deploy` workflow exist. All nine failed. Run 33313972826 ran on `main` at commit
`3b5f6cc2`. Its step 14, `read the page that is now serving`, failed. That is the same product step
under its earlier name.

So pull request 4 inherits the failure. The branch did not cause it.

## Why the page answers 502

I read the function log in eu-west-1 today. The log group is `/aws/lambda/transcript-handler`.
Every request gets the same two lines:

    {"event":"watch_page_unreadable","video_id":"gyN9lV9QgyA","cause":"bot_check","status":200,
     "has_video_details":true,"has_caption_tracks":false,"playability":"LOGIN_REQUIRED",
     "playability_reason":"Sign in to confirm you're not a bot"}
    {"event":"player_unusable","video_id":"gyN9lV9QgyA","status":200,
     "reason":"the player endpoint did not return a playable video",
     "playability":"LOGIN_REQUIRED","playability_reason":"Sign in to confirm you're not a bot"}

The platform refuses both entry points from the address of the function. It asks the caller to sign
in to prove it is not a machine. This is a live reading, not a copy of an earlier note.

## The code is proved correct

The refusal is a property of the address. It is not a defect in the branch.

I ran the live suite from this sandbox. The platform does not refuse this sandbox. `npm run
test:live` exits 0 and two tests pass. The readings on video `gyN9lV9QgyA`:

- The watch page path reads 560 segments and 19,420 characters.
- With the watch page refused by a double, the player path reads the same 560 segments and the same
  19,420 characters.
- A video with no captions answers 200 and stores `has_captions` false.
- A video that does not exist answers 404. A malformed id answers 400.
- A second visit costs no fetch. The count stays at 3.

Captured from a run of `npm run test:live` in this sandbox on 1 September 2026. To reproduce it you
need an address the platform does not refuse, and this sandbox is one. The deployed function is not.

So the same code reads the text from one address and gets refused at another.

## Why I did not fix it

The function must reach the platform from an address the platform accepts. I found three ways to do
that. Each one spends money or stores a credential, so a person must choose:

- A network address translation gateway with a fixed address. It bills while nobody visits.
  `CLAUDE.md` refuses it by name.
- A proxy service. It is a paid dependency.
- Stored account cookies for the platform. That is the credential of a person, and a policy choice.

`CLAUDE.md` gives the instruction for this case. If the work seems to need something on the refused
list, do not build it, say so, and stop. A person decides.

I did not weaken the gate. The gate is correct: it asks the deployed page for a transcript and it
does not get one. I deleted no assertion and I lowered no threshold.

I did not guess either. Two clients are measured and the platform refuses both: the web client at
the watch page, and the iOS client at the player endpoint. I cannot test a third client from a
refused address, because this sandbox is not refused. To try one I must deploy it and watch, and
that is a guess, not a diagnosis.

## What a person must decide

Name the egress to buy. The deploy gate can pass after that, and the code behind it already works.
