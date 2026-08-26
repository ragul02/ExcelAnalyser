# Code Signing for NSIS Installer (Optional)

## Overview

While the Microsoft Store will automatically sign your `.appx` package, you may also want to sign the NSIS installer (`.exe`) to avoid Windows SmartScreen warnings.

**Note:** This is OPTIONAL. Most users will get your app through the Microsoft Store.

## When to Sign the NSIS Installer

Sign the `.exe` installer if you plan to:
- Distribute the app outside the Microsoft Store
- Provide direct downloads from your website
- Distribute through enterprise channels
- Avoid Windows SmartScreen "Unknown Publisher" warnings

## Cost

- **Standard Code Signing Certificate:** $70-$200/year
  - From DigiCert, Sectigo, GlobalSign, etc.
  - Validates your organization identity
  - Valid for 1-3 years

- **EV Code Signing Certificate:** $300-$500/year
  - Extended Validation certificate
  - Includes hardware token (USB key)
  - Immediate SmartScreen reputation
  - Required for kernel-mode drivers

## Purchasing a Certificate

### Recommended Certificate Authorities

1. **DigiCert** (https://www.digicert.com)
   - Most trusted CA
   - Good reputation with Microsoft SmartScreen
   - ~$200/year for standard, ~$500/year for EV

2. **Sectigo (formerly Comodo)** (https://sectigo.com)
   - Affordable option
   - ~$70/year for standard, ~$300/year for EV

3. **GlobalSign** (https://www.globalsign.com)
   - Well-established CA
   - ~$150/year for standard

### Certificate Types

**Standard Code Signing Certificate**
- Validates organization name
- Requires business verification (1-3 days)
- Delivered as `.pfx` or `.p12` file
- Starts with "Unknown Publisher" status
- Gains reputation over time

**EV (Extended Validation) Code Signing Certificate**
- Stricter validation (5-7 days)
- Requires physical address verification
- Delivered on USB hardware token
- **Immediate SmartScreen trust** (no unknown publisher warning)
- Recommended for commercial software

## Setup Process

### 1. Purchase Certificate

1. Choose a CA (DigiCert, Sectigo, etc.)
2. Select "Code Signing Certificate"
3. Complete organization verification
4. Receive certificate (`.pfx` file or USB token)

### 2. Install Certificate

For `.pfx` file:
```powershell
# Import to Windows Certificate Store
certutil -importPFX "path\to\certificate.pfx"
```

For USB token:
- Plug in the token
- Install manufacturer's software (usually included)

### 3. Configure electron-builder

Update `package.json`:

```json
"win": {
  "target": ["nsis", "appx"],
  "icon": "src/assets/icon/icon.ico",
  "certificateFile": "path/to/certificate.pfx",
  "certificatePassword": "YOUR_CERT_PASSWORD",
  "signingHashAlgorithms": ["sha256"],
  "publisherName": "Your Company Name"
}
```

**⚠️ Security Warning:** Don't commit certificates or passwords to Git!

### 4. Use Environment Variables (Recommended)

Instead of hardcoding, use environment variables:

**package.json:**
```json
"win": {
  "target": ["nsis", "appx"],
  "icon": "src/assets/icon/icon.ico",
  "signingHashAlgorithms": ["sha256"],
  "publisherName": "Southernstore apps"
}
```

**Set environment variables before building:**
```powershell
$env:CSC_LINK = "C:\path\to\certificate.pfx"
$env:CSC_KEY_PASSWORD = "your_password"
npm run electron:build:win
```

Or create a `.env` file (add to `.gitignore`):
```
CSC_LINK=C:\path\to\certificate.pfx
CSC_KEY_PASSWORD=your_password
```

### 5. Build and Verify

```bash
npm run electron:build:win
```

Verify signature:
```powershell
Get-AuthenticodeSignature "dist-electron\Excel Analyser Setup 1.0.0.exe"
```

Should show:
- Status: Valid
- SignerCertificate: Your certificate details

## Testing Signed Installer

1. Right-click the `.exe` file
2. Select "Properties" → "Digital Signatures" tab
3. Verify your signature is present
4. Double-click to install
5. Should see "Verified publisher" instead of "Unknown publisher"

## SmartScreen Reputation

Even with a valid signature, new certificates may show SmartScreen warnings initially. To build reputation:

1. **Get EV Certificate** - Instant reputation (recommended)
2. **Or wait** - Gain reputation over time as users download
3. **Submit to Microsoft** - Can request manual review (rare)

Reputation factors:
- Number of installations
- Low malware reports
- Certificate age
- Publisher history

## Alternative: Skip Signing Initially

If you're just getting started:

1. **Distribute via Microsoft Store only** (automatic signing)
2. **Build reputation** and user base
3. **Purchase certificate later** when you need direct distribution

This saves ~$200-500 initially while you validate your app's market fit.

## GitHub Actions CI/CD (Advanced)

For automated builds with signing:

```yaml
# .github/workflows/build.yml
name: Build and Sign
on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Decode certificate
        run: |
          echo "${{ secrets.CERTIFICATE_BASE64 }}" | base64 -d > cert.pfx
      
      - name: Build and sign
        env:
          CSC_LINK: cert.pfx
          CSC_KEY_PASSWORD: ${{ secrets.CERTIFICATE_PASSWORD }}
        run: npm run electron:build:win
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: windows-installer
          path: dist-electron/*.exe
```

Store certificate as base64 in GitHub Secrets:
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("certificate.pfx"))
```

## Summary

### For Microsoft Store Distribution (Your Current Plan)
✅ **No code signing needed** - Microsoft signs automatically
✅ **Recommended approach** - Start here
✅ **Free** - No certificate costs

### For Direct Distribution (Optional)
⚠️ **Code signing recommended** - Avoid SmartScreen warnings
💰 **Cost:** $70-500/year depending on certificate type
⏰ **Setup time:** 1-7 days for certificate verification

### Recommendation

**Start with Microsoft Store only:**
1. No signing costs
2. Automatic updates
3. Built-in payment system
4. User trust from Store branding

**Add code signing later if:**
- You need enterprise distribution
- You want direct website downloads
- You have budget for EV certificate ($300-500)

## Resources

- [DigiCert Code Signing](https://www.digicert.com/signing/code-signing-certificates)
- [Sectigo Code Signing](https://sectigo.com/ssl-certificates-tls/code-signing)
- [electron-builder Code Signing](https://www.electron.build/code-signing)
- [Microsoft SmartScreen](https://docs.microsoft.com/windows/security/threat-protection/microsoft-defender-smartscreen/)
