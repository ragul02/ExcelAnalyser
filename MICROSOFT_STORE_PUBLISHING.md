# Microsoft Store Publishing Guide

## Overview

This guide walks you through publishing your Excel Analyser app to the Microsoft Store.

## Prerequisites

1. Microsoft Partner Center account (Developer account)
2. One-time registration fee ($19 for individuals, $99 for companies)
3. Windows 10/11 SDK installed (for testing)

## Step 1: Create Microsoft Partner Center Account

1. Go to https://partner.microsoft.com/dashboard
2. Sign up for a developer account
3. Pay the one-time registration fee
4. Complete identity verification (can take 1-3 business days)

## Step 2: Reserve Your App Name

1. In Partner Center, go to "Apps and games"
2. Click "New product" → "MSIX or PWA app"
3. Reserve your app name (e.g., "Excel Analyser")
4. This name must be unique across the Microsoft Store

## Step 3: Get Your App Identity

After reserving the name:

1. Go to your app's page in Partner Center
2. Navigate to "Product management" → "Product identity"
3. Copy these values:
   - **Package/Identity/Name** (e.g., `12345Southernstoreapps.DataAnalyzer`)
   - **Package/Identity/Publisher** (e.g., `CN=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX`)
   - **Publisher display name** (e.g., `Southernstore apps`)

## Step 4: Update package.json

Replace the placeholder values in `package.json` under the `appx` section:

```json
"appx": {
  "identityName": "YOUR_PACKAGE_IDENTITY_NAME",
  "publisher": "YOUR_PUBLISHER_CN",
  "displayName": "Excel Analyser",
  "publisherDisplayName": "YOUR_PUBLISHER_DISPLAY_NAME",
  "backgroundColor": "#464646",
  "languages": ["en-US"]
}
```

**Example:**
```json
"appx": {
  "identityName": "12345Southernstoreapps.DataAnalyzer",
  "publisher": "CN=12345678-ABCD-EFGH-1234-567890ABCDEF",
  "displayName": "Excel Analyser",
  "publisherDisplayName": "Southernstore Apps",
  "backgroundColor": "#464646",
  "languages": ["en-US"]
}
```

## Step 5: Rebuild with Correct Identity

After updating package.json:

```bash
npm run electron:build:win
```

This will generate a new `.appx` file with your store identity.

## Step 6: Test the APPX Package Locally

Before submitting to the Store:

1. Right-click the `.appx` file in `dist-electron/`
2. Select "Properties" → "Digital Signatures"
3. Verify the publisher matches your identity

To install locally for testing:
```powershell
Add-AppxPackage -Path "dist-electron\Excel Analyser Setup 0.0.0.appx"
```

**Note:** You may need to enable Developer Mode in Windows Settings.

## Step 7: Prepare Store Listing

In Partner Center, complete:

### Properties
- Category (e.g., Productivity, Business)
- Privacy policy URL
- Support contact info

### Age Ratings
- Complete the age rating questionnaire
- Most business apps are rated "Everyone"

### Packages
- Upload your `.appx` file from `dist-electron/`
- Microsoft will automatically sign it for the Store

### Store Listings
- App description (10,000 characters max)
- Screenshots (at least 1, max 10)
  - Minimum size: 1366 x 768 pixels
  - PNG or JPG format
- App icon (1:1 aspect ratio, 300 x 300 px minimum)
- Feature list
- Keywords (7 max)

### Pricing and Availability
- Select markets (countries/regions)
- Set pricing (Free or Paid)
- Set visibility (Public, Private, or Hidden)

## Step 8: Submit for Certification

1. Review all sections in Partner Center
2. Click "Submit for certification"
3. Certification typically takes 24-48 hours
4. You'll receive email updates on certification status

## Step 9: Monitor Certification

Microsoft will check:
- App crashes or hangs
- Security compliance
- Content policy compliance
- Technical requirements

If issues are found, you'll get a detailed report and can resubmit after fixing.

## Step 10: Publish

After certification passes:
- The app will be published to the Microsoft Store
- Users can find and install it
- Updates follow the same submission process

## App Updates

To release updates:

1. Update version in `package.json`:
   ```json
   "version": "1.0.1"
   ```

2. Rebuild:
   ```bash
   npm run electron:build:win
   ```

3. In Partner Center:
   - Create a new submission
   - Upload new `.appx` file
   - Update release notes
   - Submit for certification

**Important:** Version numbers must always increase.

## Troubleshooting

### "Package could not be registered" Error
- Ensure Developer Mode is enabled
- Check if an older version is installed and uninstall it
- Verify package identity matches Partner Center

### Certification Failures
- Check for crashes: Test thoroughly before submission
- Review content policies: No offensive content
- Test on clean Windows 10/11 system

### Store Identity Mismatch
- Verify `identityName` and `publisher` exactly match Partner Center
- These values are case-sensitive

## Resources

- [Microsoft Partner Center](https://partner.microsoft.com/dashboard)
- [App Certification Requirements](https://docs.microsoft.com/windows/uwp/publish/the-app-certification-process)
- [MSIX Packaging](https://docs.microsoft.com/windows/msix/)
- [electron-builder APPX docs](https://www.electron.build/configuration/appx)

## Cost Summary

- **Developer Account:** $19 (individual) or $99 (company) - one-time fee
- **Store Listing:** Free
- **App Distribution:** Free (Microsoft doesn't charge per download)
- **Transaction Fee:** 15% if you charge for the app (0% if free)

## Tips

1. **Version Management**: Use semantic versioning (1.0.0, 1.0.1, 1.1.0)
2. **Screenshots**: Show your app's best features
3. **Description**: First 200 characters are most important (shown in search)
4. **Keywords**: Research what users search for
5. **Testing**: Test on multiple Windows versions (10 and 11)
6. **Updates**: Release updates regularly to improve store ranking

## Auto-Update Support

Once published, your app can auto-update through the Microsoft Store. Users will get automatic updates when you submit new versions.

To check for updates programmatically in your app, you can use the Windows Store Services SDK (optional).
