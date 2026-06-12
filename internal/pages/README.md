# Pages

Static HTML pages yang di-embed ke binary untuk response WAF.

## File Structure

```
internal/pages/
├── README.md                    # This file
├── pages.go                     # Go embed & template loader
├── blocked.html                 # 403 Forbidden page
├── default.html                 # Default landing page
├── challenge.html               # Challenge page (PRODUCTION - obfuscated)
└── challenge.readable.html      # Challenge page (DEVELOPMENT - readable)
```

## Challenge Page Versions

### `challenge.html` (Production)
- **Purpose**: Production version dengan obfuscated JavaScript
- **Usage**: Di-embed dan di-serve ke client
- **Security**: JS di-obfuscate untuk mencegah reverse engineering
- **DO NOT EDIT**: Edit `challenge.readable.html` instead

### `challenge.readable.html` (Development/Reference)
- **Purpose**: Readable version untuk development dan dokumentasi
- **Usage**: Reference only, tidak di-embed
- **Features**:
  - Formatted CSS dengan comments
  - Readable JavaScript dengan JSDoc
  - Clear variable names
  - Detailed comments

## Editing Challenge Page

### 1. Edit Readable Version

```bash
# Edit the readable version
vim internal/pages/challenge.readable.html
```

### 2. Test Locally

Temporarily swap files untuk testing:

```bash
# Backup production
cp internal/pages/challenge.html internal/pages/challenge.html.bak

# Use readable version
cp internal/pages/challenge.readable.html internal/pages/challenge.html

# Build & test
go build -o wafer.exe .
./wafer.exe

# Restore production
mv internal/pages/challenge.html.bak internal/pages/challenge.html
```

### 3. Obfuscate JavaScript

Gunakan online obfuscator atau tool:

**Option A: Online Tool**
- https://obfuscator.io/
- Copy JS dari `challenge.readable.html`
- Settings:
  - String Array: ✅
  - String Array Encoding: Base64
  - String Array Threshold: 0.75
  - Rotate String Array: ✅
  - Shuffle String Array: ✅
  - Control Flow Flattening: ❌ (performance)
  - Dead Code Injection: ❌ (size)

**Option B: CLI Tool**
```bash
npm install -g javascript-obfuscator

# Extract JS
# Obfuscate
javascript-obfuscator script.js --output script.obf.js \
  --string-array true \
  --string-array-encoding base64 \
  --string-array-threshold 0.75

# Copy obfuscated JS back to challenge.html
```

### 4. Update Production File

```bash
# Manually replace <script> section in challenge.html
# with obfuscated version
vim internal/pages/challenge.html
```

### 5. Build & Deploy

```bash
go build -o wafer.exe .
```

## Challenge Page Features

### Browser Integrity Check

1. **Feature Detection** (8 checks)
   - localStorage
   - sessionStorage
   - indexedDB
   - cookieEnabled
   - requestAnimationFrame
   - Promise
   - fetch
   - canvas context

2. **Proof of Work**
   - 1M iterations of Math.sqrt()
   - Proves JavaScript execution
   - ~50-100ms on modern browsers

3. **Server Verification**
   - Endpoint: `/__waf_verify`
   - Validates HTTP headers
   - Sets HMAC-signed cookie
   - Cookie name: `ok`

### Configuration

Template variables dari Go:

```go
type ChallengePageData struct {
    Title       string  // Page title
    Description string  // Description text
    Footer      string  // Footer text
    RayID       string  // Unique request ID
    ShowRayID   bool    // Show/hide Ray ID
    ScanMs      int     // Wait time before verify (ms)
    RedirMs     int     // Wait time before redirect (ms)
}
```

Default values:
- `ScanMs`: 2400ms (80% of 3s)
- `RedirMs`: 600ms (20% of 3s)
- Total: 3 seconds

### Customization

Edit di database via API:

```bash
PUT /api/v1/settings/bot
{
  "challenge": {
    "title": "Custom Title",
    "description": "Custom description",
    "footer": "Custom footer",
    "show_ray_id": true
  }
}
```

## Security Considerations

### Why Obfuscation?

1. **Prevent Bypass**: Harder untuk bot membaca logic
2. **Hide Checks**: Browser checks tidak obvious
3. **PoW Protection**: Computational challenge tidak jelas
4. **Endpoint Hiding**: `/__waf_verify` tidak mudah ditemukan

### Limitations

⚠️ Obfuscation bukan enkripsi:
- Determined attacker masih bisa reverse
- Hanya menambah friction, bukan absolute protection
- Combine dengan server-side validation

### Best Practices

1. **Rotate obfuscation**: Re-obfuscate setiap update
2. **Change PoW**: Variasikan computational challenge
3. **Monitor bypass**: Track failed verifications
4. **Rate limit**: Limit `/__waf_verify` endpoint
5. **Strong secret**: Use strong `WAF_SECRET` env var

## Troubleshooting

### Challenge Loop

**Symptom**: User stuck di challenge page

**Causes**:
- Cookie blocked
- `WAF_SECRET` changed
- IP/UA changed mid-verification

**Solution**:
- Check browser cookie settings
- Verify `WAF_SECRET` consistency
- Check proxy/load balancer config

### JS Errors

**Symptom**: Console errors, verification fails

**Causes**:
- Obfuscation broke functionality
- Template variable issue
- Browser compatibility

**Solution**:
- Test with readable version first
- Check browser console
- Verify template variables render correctly

### Performance Issues

**Symptom**: Challenge takes too long

**Causes**:
- PoW too heavy
- Network latency
- Slow device

**Solution**:
- Reduce PoW iterations (1M → 500K)
- Decrease `ScanMs` (3s → 2s)
- Optimize obfuscation settings

## Testing

### Manual Test

```bash
# 1. Enable under attack mode
curl -X PUT http://localhost:3000/api/v1/apps/1/under-attack \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"enabled": true}'

# 2. Access website
curl -v http://localhost:3000/

# Expected: 200 OK with challenge page HTML

# 3. Check browser
# Open in browser, should see challenge → verify → redirect
```

### Automated Test

```bash
# Challenge page should NOT be bypassable with curl
curl -v http://localhost:3000/ | grep "Checking your browser"

# Should fail to verify without proper headers
curl -v http://localhost:3000/__waf_verify
# Expected: 403 Forbidden
```

## References

- [Browser Integrity Check Documentation](../../docs/BROWSER-INTEGRITY-CHECK.md)
- [Flow Documentation](../../docs/FLOW.md)
- [Cloudflare Challenge](https://blog.cloudflare.com/cloudflare-bot-management/)
- [JavaScript Obfuscator](https://obfuscator.io/)
