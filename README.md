# Transcript

A page that turns a video into text. Give it a video id and it shows the captions that video already
carries.

    /videos?id=gyN9lV9QgyA

Captions only. There is no speech to text and no audio download. A video with no captions gets a page
that says so.

## How a read works

    reader -> CloudFront -> Lambda function url -> DynamoDB
                                |
                                +-> youtube.com, only when the store has no item

The edge holds a page for a day, so a second reader costs nothing. The store holds one item per video
id, so a second read costs no fetch even when the edge has forgotten. The platform is reached once
per video, ever.

## Getting the caption text

This is the hard part, and it is worth writing down.

The list of caption tracks is readable from the watch page with no credential. The `baseUrl` in that
list is signed, and fetching it plainly returns HTTP 200 with an empty body. An empty body is how the
platform refuses a request it does not trust. Cookies, a referer, the legacy `timedtext` addresses
and the player endpoint under six client names all return the same nothing.

The request that works carries a proof of origin token:

    GET <baseUrl>&fmt=json3&c=WEB&pot=<token>
    cookie:  the cookies the watch page set on the same request
    referer: https://www.youtube.com/watch?v=<video id>

The token comes from the platform's own attestation program, which is JavaScript that expects a
browser, so it runs inside a JSDOM window. The step that matters: **the token is bound to the video
id, not to the visitor identity**. Binding it to the visitor identity is what every guide describes,
it is correct for the player, and for captions it returns zero bytes.

The integrity token behind the mint lasts twelve hours, so a warm function attests once and mints per
video after that.

## What the deployed function actually gets

Captured from the deployed function on 31 August 2026, in eu-west-1, on the `watch_page_unreadable`
line of its own log:

    {"event":"watch_page_unreadable","video_id":"gyN9lV9QgyA","cause":"bot_check",
     "status":200,"bytes":1412860,"has_video_details":true,"has_caption_tracks":false,
     "has_player_response":true,"playability":"LOGIN_REQUIRED",
     "playability_reason":"Sign in to confirm you are not a bot"}

The platform serves the function a full watch page, HTTP 200, over a megabyte, and that page carries
no caption track and a player response that asks the caller to prove it is a person. The same
request from a laptop returns the video and 560 caption segments. The block is on the address the
function calls from, and it lands on the watch page, before the proof of origin work above is
reached.

Reading it needed the boundary to say so. Before this, the title came back null and every cause threw
the same error, so a refusal, a rate limit and a deleted video all reached the reader as one 404
saying "No video with that id".

## What gets the text when the watch page is refused

The refusal above lands on the watch page, so no caption address is ever read and the proof of origin
work is never reached. Asking the same question a different way answers it. This request works, and
it carries no token at all:

    POST https://www.youtube.com/youtubei/v1/player?prettyPrint=false
    content-type: application/json
    user-agent: com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_0 like Mac OS X)
    x-youtube-client-name: 5
    x-youtube-client-version: 20.10.4

    {"videoId":"gyN9lV9QgyA","context":{"client":{"clientName":"IOS","clientVersion":"20.10.4",
     "deviceMake":"Apple","deviceModel":"iPhone16,2","hl":"en","gl":"US"}},
     "contentCheckOk":true,"racyCheckOk":true}

It answers with the title and a caption track. That track's address with `&fmt=json3` added returns
406,491 bytes of json3, which is 560 segments and 19,420 characters on `gyN9lV9QgyA`. That is the
same count the watch page path produces.

Measured on 1 September 2026. Three readings behind it:

- The caption address from the watch page returns HTTP 200 and zero bytes without a minted token,
  from an address the platform does not refuse at all. The token is what that path needs.
- The caption address from the player endpoint needs no token. Plain, it returns 406,491 bytes.
- The `ANDROID` client answers too, but ignores `fmt=json3` and returns XML, so `IOS` is the one used.

The watch page is still read first, because it is the path that tells a video with no captions apart
from a video that is missing. The player endpoint is asked only after a refusal, and a proved missing
video never reaches it. When the player endpoint has nothing to add, the refusal the watch page named
is what the reader gets, unchanged.

## What a read can fail with

Each cause gets its own page, its own status and its own line in the log, and only one of them is a
404:

    video_missing      404  the platform says the video is unplayable
    bot_check          502  the platform wants proof the caller is a person
    consent_wall       502  a consent page came back instead of the video
    rate_limited       429  too many requests, and the answer carries retry-after
    platform_error     502  a status that is not a page
    unrecognised_page  502  a page with no video and no reason given
    captions_refused   502  the video was found, the caption text was refused
    captions_not_json  502  the caption endpoint answered with something else
    captions_empty     502  the track holds no readable line

A missing video is proved, never assumed. Anything the code cannot recognise is a refusal, because
calling an unrecognised page a missing video is what told readers a working video was deleted.

Nothing written to the log is a credential. The caption address is signed and the request carries
cookies and a minted token, so an address is cut to its host and path before it is written.

## The gates

    npm ci
    npm run typecheck
    npm run lint
    npm run test
    npm run test:count     the suite, and it fails when the suite found no tests
    npm run build
    cd infra && terraform fmt -check -recursive && terraform validate

`npm run test:live` talks to the real platform and is not one of the gates. It reads four videos: one
with captions a machine wrote, one with none, one that does not exist, and a malformed id.

## Shipping

The pipeline plans on a pull request and applies on a merge into `main`. Nothing is applied from a
laptop or a sandbox. The apply job opens the page it just deployed and fails when the page does not
answer.

The pipeline authenticates from the repository secrets `AWS_ACCESS_KEY_ID` and
`AWS_SECRET_ACCESS_KEY`, with `AWS_REGION` as a repository variable. No credential is in this
repository.

## Cost

Serverless throughout. No network address translation gateway: the function has no virtual private
cloud, so it reaches the platform directly and nothing charges by the hour. The table is on demand.
The edge holds a page for a day. There is a monthly budget, and **its number is provisional** until a
real week is measured.
