# Microsoft Store - Quick Start Checklist

## ✅ Before You Start

- [ ] Register Microsoft Partner Center account ($19)
- [ ] Wait for identity verification (1-3 days)
- [ ] Have app screenshots ready (1366x768 min)
- [ ] Have app icon ready (300x300 min)

## 🎯 Publishing Steps

### 1. Partner Center Setup
- [ ] Go to https://partner.microsoft.com/dashboard
- [ ] Click "New product" → "MSIX or PWA app"
- [ ] Reserve app name: "Excel Analyser"
- [ ] Navigate to "Product identity"
- [ ] Copy these values:
  - Package/Identity/Name: `___________________________`
  - Package/Identity/Publisher: `CN=___________________________`
  - Publisher Display Name: `___________________________`

### 2. Update Configuration

Edit `package.json`, find the `appx` section and update:

```json
"appx": {
  "identityName": "PASTE_IDENTITY_NAME_HERE",
  "publisher": "PASTE_PUBLISHER_CN_HERE",
  "displayName": "Excel Analyser",
  "publisherDisplayName": "PASTE_PUBLISHER_DISPLAY_NAME_HERE",
  "backgroundColor": "#464646",
  "languages": ["en-US"]
}
```

### 3. Build Package

```bash
npm run electron:build:win
```

Output: `dist-electron/Excel Analyser Setup X.X.X.appx`

### 4. Test Locally (Optional)

Enable Developer Mode in Windows Settings, then:

```powershell
Add-AppxPackage -Path "dist-electron\Excel Analyser Setup 0.0.0.appx"
```

### 5. Complete Store Listing

In Partner Center, fill out:

#### Properties
- [ ] Select category: Productivity / Business / Utilities
- [ ] Add privacy policy URL (if collecting data)
- [ ] Add support contact email

#### Age Ratings
- [ ] Complete questionnaire (usually "Everyone" for business apps)

#### Packages
- [ ] Upload `.appx` file from `dist-electron/`

#### Store Listings (English - United States)
- [ ] App name: Excel Analyser
- [ ] Short description (30-200 chars):
  ```
  Powerful Excel file analyzer and visualizer for data insights
  ```
- [ ] Full description (200-10000 chars)
- [ ] Upload 1-10 screenshots (PNG/JPG, 1366x768+)
- [ ] Upload app icon (300x300+, 1:1 ratio)
- [ ] Add 3-7 keywords: `excel, analyzer, data, visualization, spreadsheet`

#### Pricing
- [ ] Select markets (countries)
- [ ] Set pricing: Free or Paid
- [ ] Set visibility: Public

### 6. Submit

- [ ] Review all sections (green checkmarks)
- [ ] Click "Submit for certification"
- [ ] Wait 24-48 hours for certification
- [ ] Receive email notification

## 🚀 After Approval

Your app will be live on the Microsoft Store!

Users can find it by searching "Excel Analyser" or via direct link:
`https://www.microsoft.com/store/apps/YOUR_APP_ID`

## 🔄 Releasing Updates

1. Update version in `package.json`: `"version": "1.0.1"`
2. Run: `npm run electron:build:win`
3. In Partner Center, create new submission
4. Upload new `.appx` file
5. Add release notes
6. Submit for certification

## 📞 Need Help?

- Full guide: `MICROSOFT_STORE_PUBLISHING.md`
- Partner Center: https://partner.microsoft.com/dashboard
- Support: https://developer.microsoft.com/windows/support

## 💰 Costs

- **Registration:** $19 one-time (individual) or $99 (company)
- **Publishing:** FREE
- **Updates:** FREE
- **Downloads:** FREE
- **Commission:** 15% if paid app (0% if free)
