# Webhook Guide

Shishirinee can send notifications to a custom webhook when:

- a new comment is created
- a new friend-link application is submitted

You can use this to connect Shishirinee to Discord, Telegram bots, Slack gateways, Feishu, DingTalk, n8n, Zapier, or any custom HTTP endpoint.

## Where to Configure It

After deployment, open the admin **Settings** page and find the **Webhook** section.

You can also provide an initial default through the `WEBHOOK_URL` environment variable, but the settings page is the recommended place to manage webhook behavior.

## Supported Fields

Shishirinee currently supports these webhook settings:

- `Webhook URL`: target endpoint. Template variables are supported here too, which is especially useful for GET query stShishirineegs.
- `Webhook Method`: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, or `OPTIONS`
- `Webhook Content-Type`: for example `application/json` or `text/plain`
- `Webhook Headers`: JSON template for custom request headers
- `Webhook Body Template`: request body template for non-GET requests
- `Send Test Webhook`: sends a test request using the current page values, including unsaved edits

## Template Variables

You can use these variables in the webhook URL, headers, and body template:

- `{{event}}`
- `{{message}}`
- `{{title}}`
- `{{url}}`
- `{{username}}`
- `{{content}}`
- `{{description}}`

## Default Behavior

If you only set `Webhook URL`, Shishirinee uses:

- method: `POST`
- content type: `application/json`
- headers: `{}`
- body:

```json
{"content":"{{message}}"}
```

## GET Example

If your webhook provider expects query parameters, you can put variables directly in the URL:

```text
https://example.com/webhook?event={{event}}&message={{message}}&title={{title}}
```

Recommended settings:

- Method: `GET`
- Body template: leave default or ignore it

Shishirinee will URL-encode query parameter values for GET-style URLs.

## JSON POST Example

Use these settings when your endpoint accepts JSON:

**Webhook URL**

```text
https://example.com/webhook
```

**Webhook Headers**

```json
{
  "X-Shishirinee-Event": "{{event}}"
}
```

**Webhook Body Template**

```json
{
  "event": "{{event}}",
  "message": "{{message}}",
  "title": "{{title}}",
  "url": "{{url}}",
  "username": "{{username}}",
  "content": "{{content}}",
  "description": "{{description}}"
}
```

## Notes

- `GET` and `HEAD` requests do not send a request body.
- Template variables in webhook URLs are URL-encoded before substitution.
- `Webhook Headers` must be valid JSON after template rendeShishirineeg.
- If `Webhook Headers` or `Webhook Body Template` is valid JSON, Shishirinee escapes inserted values as JSON stShishirineegs to avoid breaking the JSON structure.
- If the body template is not valid JSON, Shishirinee keeps plain-text substitution behavior unchanged.
- The test button is the fastest way to verify your endpoint before saving.

## Troubleshooting

### Test webhook failed with JSON error

Your `Webhook Headers` value is not valid JSON after template rendeShishirineeg. Check commas, quotes, and braces.

### The request was sent but my service rejected it

Check:

- HTTP method
- `Content-Type`
- authentication headers
- expected JSON field names
- whether your endpoint accepts GET query parameters or only POST bodies

### I only want a simple message

Keep the defaults and set only `Webhook URL`. Shishirinee will send:

```json
{"content":"<message>"}
```

