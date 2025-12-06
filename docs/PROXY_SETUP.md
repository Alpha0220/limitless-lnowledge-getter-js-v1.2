# Proxy Setup Guide for YouTube Transcript API

## Overview

This guide explains how to configure proxy settings to avoid IP blocking when using the YouTube Transcript API.

## Why Use Proxy?

YouTube may block requests from:
- Cloud provider IPs (AWS, Google Cloud, Azure)
- IPs making too many requests
- Known data center IPs

Using residential proxies helps bypass these restrictions.

---

## Option 1: Webshare Residential Proxy (Recommended)

### Why Webshare?
- ✅ Rotating residential IPs (looks like real users)
- ✅ Automatic IP rotation
- ✅ Lower chance of being blocked
- ✅ Easy setup

### Setup Steps:

1. **Sign up for Webshare**
   - Go to https://www.webshare.io/
   - Create an account
   - Purchase "Residential" package (NOT "Proxy Server" or "Static Residential")

2. **Get Credentials**
   - Login to Webshare dashboard
   - Go to "Proxy Settings"
   - Copy your `Proxy Username` and `Proxy Password`

3. **Configure in .env.local**
   ```bash
   WEBSHARE_USERNAME=your_username
   WEBSHARE_PASSWORD=your_password
   WEBSHARE_COUNTRY=th  # Optional: Filter by country (th, us, jp, etc.)
   ```

4. **Restart your dev server**
   ```bash
   pnpm dev
   ```

### Country Filtering:
- `WEBSHARE_COUNTRY=th` - Use only Thai IPs
- `WEBSHARE_COUNTRY=us` - Use only US IPs
- `WEBSHARE_COUNTRY=th,us` - Use Thai or US IPs
- Leave empty - Use any country

---

## Option 2: Generic HTTP/HTTPS Proxy

### Use any proxy provider:

```bash
# Format: http://username:password@proxy-domain.com:port
# Or: http://proxy-domain.com:port (if no authentication)

YOUTUBE_PROXY_HTTP=http://user:pass@proxy.example.com:8080
YOUTUBE_PROXY_HTTPS=https://user:pass@proxy.example.com:8080
```

### Examples:

**With Authentication:**
```bash
YOUTUBE_PROXY_HTTP=http://username:password@proxy.example.com:8080
```

**Without Authentication:**
```bash
YOUTUBE_PROXY_HTTP=http://proxy.example.com:8080
```

**SOCKS5 Proxy:**
```bash
# Note: SOCKS5 requires different format
YOUTUBE_PROXY_HTTP=socks5://user:pass@proxy.example.com:1080
```

---

## Option 3: System-wide Proxy

Standard environment variables that many tools recognize:

```bash
HTTP_PROXY=http://proxy.example.com:8080
HTTPS_PROXY=https://proxy.example.com:8080
```

---

## Priority Order

The app checks proxy configuration in this order:

1. **Webshare Proxy** (if `WEBSHARE_USERNAME` and `WEBSHARE_PASSWORD` are set)
2. **Custom YouTube Proxy** (if `YOUTUBE_PROXY_HTTP` or `YOUTUBE_PROXY_HTTPS` are set)
3. **System Proxy** (if `HTTP_PROXY` or `HTTPS_PROXY` are set)
4. **No Proxy** (direct connection)

---

## Combining with Cookies

You can use proxy together with cookies for maximum effectiveness:

```bash
# Proxy configuration
WEBSHARE_USERNAME=your_username
WEBSHARE_PASSWORD=your_password

# Cookies (optional but recommended)
YOUTUBE_COOKIES="VISITOR_INFO1_LIVE=xxx; YSC=xxx; PREF=xxx"
```

---

## Testing Proxy Configuration

1. **Check if proxy is being used:**
   - Look at server logs when making a request
   - You should see: `Using proxy: Webshare Residential Proxy` or similar

2. **Test with a video:**
   - Try fetching transcript from a YouTube video
   - If proxy works, you should get transcript successfully
   - If blocked, you'll see error messages

3. **Common Issues:**
   - **Proxy not working**: Check credentials and proxy URL format
   - **Still blocked**: Try different proxy provider or add cookies
   - **Connection timeout**: Check proxy server is accessible

---

## Troubleshooting

### Issue: Proxy not being used

**Solution:**
- Check `.env.local` file exists and has correct values
- Restart dev server after changing `.env.local`
- Check server logs for proxy info messages

### Issue: Still getting blocked

**Solutions:**
1. Try Webshare residential proxy (better than datacenter proxies)
2. Add cookies (`YOUTUBE_COOKIES`)
3. Use country filtering (`WEBSHARE_COUNTRY`)
4. Deploy to Vercel (better IP reputation)

### Issue: Connection timeout

**Solutions:**
- Verify proxy server is accessible
- Check proxy URL format is correct
- Try different proxy server
- Check firewall/network settings

---

## Best Practices

1. **Use Residential Proxies**: Better success rate than datacenter IPs
2. **Rotate IPs**: Use services that automatically rotate IPs
3. **Add Cookies**: Combine proxy with cookies for best results
4. **Rate Limiting**: Don't make too many requests too quickly
5. **Deploy to Vercel**: Production deployment usually has better IP reputation

---

## Example .env.local

```bash
# Cookies (for authentication)
YOUTUBE_COOKIES="VISITOR_INFO1_LIVE=xxx; YSC=xxx"

# Webshare Proxy (Recommended)
WEBSHARE_USERNAME=your_username
WEBSHARE_PASSWORD=your_password
WEBSHARE_COUNTRY=th

# Or Generic Proxy
# YOUTUBE_PROXY_HTTP=http://user:pass@proxy.example.com:8080
# YOUTUBE_PROXY_HTTPS=https://user:pass@proxy.example.com:8080

# API Key (for language detection)
YOUTUBE_API_KEY=your_api_key

# Country Code
YOUTUBE_COUNTRY=TH
```

---

## References

- [Webshare.io](https://www.webshare.io/)
- [YouTube Transcript API - IP Blocking](https://github.com/jdepoix/youtube-transcript-api#working-around-ip-bans)
- [Node.js Proxy Configuration](https://nodejs.org/api/http.html#http_http_request_options_callback)

