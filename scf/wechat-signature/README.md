# WeChat signature SCF

Tencent SCF event function used to sign WeChat JS-SDK requests with a fixed
public egress IP.

## Runtime

- Node.js 18 or newer
- Handler: `index.main_handler`
- Function URL parameter compatibility: disabled

## Environment variables

- `WECHAT_APP_ID`: official account AppID
- `WECHAT_APP_SECRET`: official account AppSecret
- `ALLOWED_ORIGIN`: `https://jiajiwei.top`
- `SIGNER_TOKEN`: a randomly generated private token shared only with Vercel

Deploy the contents of this directory so that `index.js` is at the root of the
SCF code package. The function URL can use open authorization because the
handler requires `Authorization: Bearer <SIGNER_TOKEN>` on every request.

Vercel must define the following server-only variables:

- `WECHAT_SIGNER_URL`: the SCF HTTPS function URL
- `WECHAT_SIGNER_TOKEN`: the same value as SCF's `SIGNER_TOKEN`
