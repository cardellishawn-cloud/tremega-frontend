# Monetization Integration Guide

## Files Created
1. **MonetizationManager.cs** - Singleton with ads and IAP
2. **MonetizationUI.cs** - UI controller for monetization buttons

## Setup Steps

### 1. Install Google Mobile Ads Unity Plugin
- Download from: https://developers.google.com/admob/unity/quick-start
- Import into project
- Follow setup wizard to add AdMob App ID
- The TODOs in MonetizationManager.cs show where to add real ad calls

### 2. Install Unity IAP
- Window > Package Manager > Unity Registry
- Install "In App Purchasing"
- Window > Services > In-App Purchasing > Enable
- Configure SKUs in IAP Catalog:
  - `remove_ads` - Non-consumable
  - `battle_pass` - Subscription

### 3. Scene Setup
Add `MonetizationManager` to a GameObject in your initial scene:
```
Create Empty GameObject: "MonetizationManager"
Add Component: MonetizationManager.cs
```

### 4. Ad Unit IDs (Test vs Production)
Edit MonetizationManager in Inspector:
- **For Testing:** Leave Banner/Rewarded IDs empty (uses test IDs)
- **For Production:** Enter your real Ad Unit IDs

## Integration Points

### RunManager - Show Banner on Floor Select

```csharp
public class RunManager : MonoBehaviour
{
    // ... existing code ...
    
    public void SelectFloor(int floorNumber)
    {
        // Show banner ad at floor select (if not disabled)
        MonetizationManager.Instance?.ShowBannerAd();
        
        // ... rest of floor selection logic ...
    }
    
    public void StartRun()
    {
        // Hide banner during gameplay
        MonetizationManager.Instance?.HideBannerAd();
        
        // ... start run logic ...
    }
}
```

### BattleUIController - Watch Ad Button on Victory

```csharp
public void ShowVictoryScreen(bool playerWon)
{
    // ... existing victory UI code ...
    
    if (playerWon)
    {
        // Show "Watch Ad for Bonus" button if ads enabled
        bool showAdButton = !MonetizationManager.Instance?.IsAdsDisabled() ?? false;
        watchAdButton?.SetActive(showAdButton);
    }
}

// Call from Watch Ad button
public void OnWatchAdForBonusClicked()
{
    MonetizationManager.Instance?.ShowRewardedAd();
}
```

### SettingsUI - Purchase Buttons

```csharp
public class SettingsUI : MonoBehaviour
{
    [Header("Monetization")]
    public GameObject removeAdsButton;
    public GameObject battlePassButton;
    public GameObject restorePurchasesButton; // iOS only
    
    void OnEnable()
    {
        UpdatePurchaseButtons();
    }
    
    void UpdatePurchaseButtons()
    {
        var data = MonetizationManager.Instance?.Data;
        if (data == null) return;
        
        // Hide buttons if already purchased
        removeAdsButton?.SetActive(!data.adsRemoved);
        battlePassButton?.SetActive(!data.battlePassActive);
        
        // Show restore button on iOS
        #if UNITY_IOS
        restorePurchasesButton?.SetActive(true);
        #else
        restorePurchasesButton?.SetActive(false);
        #endif
    }
    
    // Button handlers
    public void OnRemoveAdsClicked() 
    {
        MonetizationManager.Instance?.PurchaseRemoveAds();
    }
    
    public void OnBattlePassClicked()
    {
        MonetizationManager.Instance?.PurchaseBattlePass();
    }
    
    public void OnRestorePurchasesClicked()
    {
        MonetizationManager.Instance?.RestorePurchases();
    }
}
```

## Test IDs

### Google Mobile Ads Test IDs:
- **Banner:** `ca-app-pub-3940256099942544/6300978111`
- **Rewarded:** `ca-app-pub-3940256099942544/5224354917`
- **Interstitial:** `ca-app-pub-3940256099942544/1033173712`

### Unity IAP Test Mode:
- IAP automatically uses test mode in Editor
- On device, configure test accounts in Google Play Console / App Store Connect

## Events

### MonetizationManager Events:
```csharp
// Rewarded ad completed
MonetizationManager.Instance.OnRewardedAdCompleted += () => {
    // Grant +5 Shards
    CurrencyManager.Instance.AddShards(5);
};

// Purchase completed
MonetizationManager.Instance.OnPurchaseCompleted += (success) => {
    if (success)
        ShowPurchaseSuccess();
    else
        ShowPurchaseFailed();
};
```

## Data Persistence

Save data location:
- **Windows:** `%userprofile%\AppData\LocalLow\[Company]\[Product]\monetization.json`
- **Android:** `/storage/emulated/0/Android/data/[package]/files/monetization.json`
- **iOS:** `[App Sandbox]/Documents/monetization.json`

## Debug Commands

```csharp
// Toggle states for testing
MonetizationManager.Instance.Debug_SetAdsRemoved(true);
MonetizationManager.Instance.Debug_SetBattlePassActive(true);

// Check status
bool adsDisabled = MonetizationManager.Instance.IsAdsDisabled();
bool hasBattlePass = MonetizationManager.Instance.Data.battlePassActive;
```

## Launch Checklist

- [ ] Replace test Ad Unit IDs with production IDs
- [ ] Configure real SKUs in Unity IAP
- [ ] Test purchases with real store (sandbox)
- [ ] Verify ad removal hides all ads
- [ ] Test battle pass subscription
- [ ] iOS: Add "Restore Purchases" button
- [ ] Add privacy policy (required for ads)
- [ ] COPPA compliance (if targeting kids)
