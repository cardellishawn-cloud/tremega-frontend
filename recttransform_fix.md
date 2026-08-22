# RectTransform Fix for BuildDeckBuilderUI()

## Problem
Unity `new GameObject("Name")` creates a regular GameObject with Transform, not RectTransform.
When you try to use `GetComponent<RectTransform>()` on these objects, it returns null,
causing the MissingComponentException.

## Solution
Create GameObjects with `typeof(RectTransform)` explicitly:

### Change ALL GameObject creations from:
```csharp
GameObject obj = new GameObject("Name");
RectTransform rect = obj.GetComponent<RectTransform>(); // Returns null!
```

### To:
```csharp
GameObject obj = new GameObject("Name", typeof(RectTransform));
RectTransform rect = obj.GetComponent<RectTransform>(); // Works!
```

## Files to Change in BattleUIController.cs BuildDeckBuilderUI()

1. Line ~335: `deckBuilderOverlay = new GameObject("DeckBuilderOverlay", typeof(RectTransform));`
2. Line ~362: `GameObject titleGo = new GameObject("Title", typeof(RectTransform));`
3. Line ~377: `GameObject contentGo = new GameObject("Content", typeof(RectTransform));`
4. Line ~392: `GameObject gridGo = new GameObject("UnitGrid", typeof(RectTransform));`
5. Line ~450: `GameObject unitSlot = new GameObject(card.unitName ?? $"Unit_{i}", typeof(RectTransform));`
6. Line ~473: `GameObject nameGo = new GameObject("Name", typeof(RectTransform));`
7. Line ~494: `GameObject statsGo = new GameObject("Stats", typeof(RectTransform));`
8. Line ~526: `GameObject squadDisplayGo = new GameObject("SquadDisplay", typeof(RectTransform));`
9. Line ~543: `GameObject squadTitleGo = new GameObject("SquadTitle", typeof(RectTransform));`
10. Line ~569: `GameObject slotGo = new GameObject($"Slot_{i}", typeof(RectTransform));`
11. Line ~585: `GameObject slotTextGo = new GameObject("SlotText", typeof(RectTransform));`
12. Line ~622: `GameObject startBtnGo = new GameObject("StartButton", typeof(RectTransform));`
13. Line ~635: `GameObject startBtnTextGo = new GameObject("Text", typeof(RectTransform));`

## Manual Fix Instructions

1. Open BattleUIController.cs
2. Find BuildDeckBuilderUI() method
3. For each `new GameObject("...")` add `, typeof(RectTransform)` before the closing `)`
4. Save and recompile
