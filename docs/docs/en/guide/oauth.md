# Third-party sign-in and registration (OAuth)

Configure providers under **Admin → System settings → Third-party login · OAuth**. All providers are disabled by default. Only enabled, complete configurations appear above the password sign-in and registration buttons.

## Setup

1. Deploy both frontend and backend and run the database migration. The deployment script creates the OAuth tables from `server/src/db/schema.sql`.
2. Enter the public frontend origin, such as `https://blog.example.com`. Do not use the backend Worker URL or include a path.
3. Expand a provider and copy its callback URL into the provider's developer console.
4. Enter the client ID and secret, enable the provider, and click **Save third-party login settings**. This section saves independently from appearance settings.
5. Test with a real provider account. Successful authorization returns to the originating page.

Secrets are encrypted on the server and never displayed after saving. A blank secret preserves the saved value. Disable the provider when clearing its secret. Application approval and account eligibility remain subject to the provider's rules.

## Provider checklist

Callbacks follow `https://blog.example.com/api/auth/oauth/PROVIDER/callback`.

| Provider key | Credentials and setup | Official instructions |
| --- | --- | --- |
| `microsoft` | Entra Web application client ID and secret **Value**. Match supported account types with `common`, `consumers`, `organizations`, or a tenant UUID. | [Microsoft OIDC](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc) |
| `apple` | Services ID linked to an eligible App ID, 10-character Team ID and Key ID, full `.p8` PEM private key. Requires HTTPS domain and registered Return URL. | [Sign in with Apple](https://developer.apple.com/documentation/signinwithapplerestapi) |
| `github` | OAuth App Client ID and Client Secret; register Authorization callback URL. Do not use a personal access token. | [GitHub OAuth Apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps) |
| `google` | Web application OAuth client, consent screen, authorized redirect URI. Add test users or publish as required. | [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect) |
| `qq` | Approved QQ Connect website App ID / App Key and callback domain. | [QQ authorization code](https://wiki.connect.qq.com/使用authorization_code获取access_token) |
| `facebook` | Meta App ID / App Secret, Facebook Login, valid OAuth redirect URI. Complete publishing, privacy and verification requirements. | [Facebook manual login flow](https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow/) |
| `twitter` | OAuth 2.0 confidential Web App Client ID / Client Secret; enable callback and website URL. Access to `/2/users/me` and sufficient quota are required. | [X authorization code + PKCE](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code) |
| `discord` | Application OAuth2 Client ID / Client Secret and Redirect; no bot required. | [Discord OAuth2](https://discord.com/developers/docs/topics/oauth2) |
| `wechat` | Approved Open Platform **website application** AppID / AppSecret and `snsapi_login` permission. Mini Program and Official Account credentials are not interchangeable. | [WeChat website login](https://developers.weixin.qq.com/doc/oplatform/Website_App/WeChat_Login/Wechat_Login.html) |
| `feishu` | App ID / App Secret, redirect URL, published version and eligible users. Enterprise custom apps are restricted to their configured availability. | [Feishu authorization](https://open.feishu.cn/document/common-capabilities/sso/api/obtain-oauth-code) |
| `gitlab` | GitLab.com confidential application ID / Secret, `openid profile` scopes and Redirect URI. Self-hosted servers are not supported. | [GitLab OIDC](https://docs.gitlab.com/integration/openid_connect_provider/) |

See the [detailed Chinese setup guide](../../zh/guide/oauth) for platform-specific steps and troubleshooting.

## Turnstile and account security

When Turnstile is enabled, users must complete it before starting either third-party sign-in or registration. The backend verifies the token before issuing authorization state. The callback continues using that browser-bound, single-use state and does not ask for another CAPTCHA. Retrying authorization requires a new verification.

First authorization creates an ordinary local user; later authorization uses the same provider/application/user identity. Microsoft identities also include the tenant. Email and display-name matches never automatically merge accounts or grant administrator access. Existing password accounts keep their original points and unlocks. Administrators must explicitly assign any elevated role.

Provider access tokens are not retained. Local sessions use HttpOnly cookies and provider secrets are encrypted in D1 using a key derived from `JWT_SECRET`. Preserve that Worker secret with your backups; changing it requires reinitializing and re-entering the OAuth configuration. Changing a provider application ID creates a different identity namespace.

Do not cache `/api/auth/oauth/*`. For Apple, allow its HTTPS POST callback and the flow cookie. For redirect errors, compare the registered callback byte for byte, including protocol and trailing slash. For disabled buttons, complete or renew Turnstile. For test-only access, check provider publishing status and allowed users.

Mock protocol tests do not replace live acceptance testing with your own developer applications. Verify sign-in, sign-out, repeat sign-in and the registration entry before opening each provider to visitors.
