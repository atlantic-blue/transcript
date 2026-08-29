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
