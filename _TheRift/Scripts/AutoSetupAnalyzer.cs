using UnityEngine;
using TheRift.Balance;
using TheRift.Core;

namespace TheRift.Setup
{
    /// <summary>
    /// Automatically sets up BalanceAnalyzer on game startup.
    /// Uses [RuntimeInitializeOnLoadMethod] - no manual setup needed!
    /// Just like AutoSetupMonetization and AutoSetupBalanceTuner.
    /// </summary>
    public static class AutoSetupAnalyzer
    {
        // Configuration - adjust these as needed
        private const float DEFAULT_TARGET_WIN_RATE = 50f;
        private const float DEFAULT_WIN_RATE_TOLERANCE = 10f;
        private const bool DEFAULT_AUTO_APPLY = true;
        private const float DEFAULT_MIN_SEVERITY = 0.3f;
        private const int DEFAULT_RUNS_PER_ANALYSIS = 5;
        
        // Static references for global access
        public static BalanceAnalyzer Analyzer { get; private set; }
        public static RunManager RunManager { get; private set; }
        public static bool IsInitialized { get; private set; }
        
        /// <summary>
        /// Automatically runs when the game starts. No GameObject needed!
        /// </summary>
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        private static void Initialize()
        {
            Debug.Log("[AutoSetupAnalyzer] Initializing on game start...");
            
            CreateBalanceAnalyzer();
            SetupRunManager();
            CreateDebugDisplay();
            
            IsInitialized = true;
            
            Debug.Log("[AutoSetupAnalyzer] ========== SETUP COMPLETE ==========");
            Debug.Log($"[AutoSetupAnalyzer] Target Win Rate: {DEFAULT_TARGET_WIN_RATE}%");
            Debug.Log($"[AutoSetupAnalyzer] Auto-Apply: {DEFAULT_AUTO_APPLY}");
            Debug.Log($"[AutoSetupAnalyzer] Runs per Analysis: {DEFAULT_RUNS_PER_ANALYSIS}");
        }
        
        /// <summary>
        /// Creates the BalanceAnalyzer GameObject with component and config.
        /// </summary>
        private static void CreateBalanceAnalyzer()
        {
            // Check if already exists (e.g., from a previous scene load)
            Analyzer = Object.FindFirstObjectByType<BalanceAnalyzer>();
            
            if (Analyzer != null)
            {
                Debug.Log("[AutoSetupAnalyzer] Found existing BalanceAnalyzer.");
                ConfigureAnalyzer(Analyzer);
                return;
            }
            
            // Create new GameObject
            Debug.Log("[AutoSetupAnalyzer] Creating BalanceAnalyzer GameObject...");
            GameObject analyzerObj = new GameObject("BalanceAnalyzer");
            Analyzer = analyzerObj.AddComponent<BalanceAnalyzer>();
            
            // Make persistent across scenes
            Object.DontDestroyOnLoad(analyzerObj);
            
            // Configure it
            ConfigureAnalyzer(Analyzer);
            
            Debug.Log("[AutoSetupAnalyzer] BalanceAnalyzer created and configured.");
        }
        
        /// <summary>
        /// Sets up the BalanceAnalyzer configuration.
        /// BOOSTED ECONOMY: Generous starting values for player success.
        /// </summary>
        private static void ConfigureAnalyzer(BalanceAnalyzer analyzer)
        {
            var config = new BalanceAnalyzer.Config
            {
                TargetWinRate = DEFAULT_TARGET_WIN_RATE,
                WinRateTolerance = DEFAULT_WIN_RATE_TOLERANCE,
                AutoApplySuggestions = DEFAULT_AUTO_APPLY,
                MinSeverityForAutoApply = DEFAULT_MIN_SEVERITY,
                RunsPerAnalysis = DEFAULT_RUNS_PER_ANALYSIS,
                TargetAvgFloorPercent = 60f,
                TargetDamageDealtToTakenRatio = 1.5f,
                TargetShardSpendRate = 75f
            };
            
            analyzer.SetConfig(config);
            
            // Apply BOOSTED starting parameters to the tuner
            // This gives players a fighting chance from the start
            var boostedParams = new BalanceAnalyzer.BalanceTuner.BalanceParameters();
            analyzer.Tuner.SetParameters(boostedParams);
            
            Debug.Log("[AutoSetupAnalyzer] ===== BOOSTED ECONOMY APPLIED =====");
            Debug.Log("[AutoSetupAnalyzer] Configuration applied:");
            Debug.Log($"  - Target Win Rate: {DEFAULT_TARGET_WIN_RATE}%");
            Debug.Log($"  - Win Rate Tolerance: {DEFAULT_WIN_RATE_TOLERANCE}%");
            Debug.Log($"  - Auto-Apply: {DEFAULT_AUTO_APPLY}");
            Debug.Log($"  - Min Severity: {DEFAULT_MIN_SEVERITY}");
            Debug.Log($"  - Runs per Analysis: {DEFAULT_RUNS_PER_ANALYSIS}");
            Debug.Log("[AutoSetupAnalyzer] ===== BOOSTED PARAMETERS =====");
            Debug.Log($"  - Shard Generation: {boostedParams.ShardGenerationMultiplier:F2}x (+50% more shards!)");
            Debug.Log($"  - Item Cost: {boostedParams.ItemCostMultiplier:F2}x (20% cheaper items!)");
            Debug.Log($"  - Item Power: {boostedParams.ItemPowerMultiplier:F2}x (double power!)");
            Debug.Log($"  - Item Drop Rate: {boostedParams.ItemDropRate:F2}x (more drops!)");
            Debug.Log($"  - Enemy Health: {boostedParams.EnemyHealthMultiplier:F2}x (enemies weaker!)");
            Debug.Log($"  - Floor Ramp: {boostedParams.FloorDifficultyRamp:F2}x (slower difficulty curve!)");
            Debug.Log($"  - Healing Efficiency: {boostedParams.HealingEfficiency:F2}x (better healing!)");
            Debug.Log("[AutoSetupAnalyzer] Items feel ABUNDANT and POWERFUL!");
        }
        
        /// <summary>
        /// Sets up or finds RunManager and links it to BalanceAnalyzer.
        /// </summary>
        private static void SetupRunManager()
        {
            // Look for existing RunManager
            RunManager = Object.FindFirstObjectByType<RunManager>();
            
            if (RunManager != null)
            {
                Debug.Log("[AutoSetupAnalyzer] Found existing RunManager.");
            }
            else
            {
                // Create RunManager
                Debug.Log("[AutoSetupAnalyzer] Creating RunManager...");
                GameObject rmObj = new GameObject("RunManager");
                RunManager = rmObj.AddComponent<RunManager>();
                Object.DontDestroyOnLoad(rmObj);
            }
            
            // Link BalanceAnalyzer to RunManager using reflection
            if (Analyzer != null && RunManager != null)
            {
                var field = typeof(RunManager).GetField("balanceAnalyzer",
                    System.Reflection.BindingFlags.NonPublic |
                    System.Reflection.BindingFlags.Instance);
                
                if (field != null)
                {
                    field.SetValue(RunManager, Analyzer);
                    Debug.Log("[AutoSetupAnalyzer] Linked BalanceAnalyzer to RunManager.");
                }
                else
                {
                    Debug.LogWarning("[AutoSetupAnalyzer] Could not link BalanceAnalyzer to RunManager (field not found).");
                }
            }
        }
        
        /// <summary>
        /// Creates the debug display stub - NO UI RENDERING.
        /// All debug data logs to console only via BalanceAnalyzer.
        /// </summary>
        private static void CreateDebugDisplay()
        {
            // Check if already exists
            var existingDisplay = Object.FindFirstObjectByType<BalanceDebugDisplay>();
            
            if (existingDisplay != null)
            {
                return;
            }
            
            // Create minimal stub (no UI created)
            GameObject displayObj = new GameObject("BalanceDebugDisplay");
            displayObj.AddComponent<BalanceDebugDisplay>();
            Object.DontDestroyOnLoad(displayObj);
        }
        
        /// <summary>
        /// Gets the BalanceAnalyzer instance (creates if needed).
        /// </summary>
        public static BalanceAnalyzer GetAnalyzer()
        {
            if (Analyzer == null && !IsInitialized)
            {
                Initialize();
            }
            return Analyzer;
        }
        
        /// <summary>
        /// Gets the RunManager instance (creates if needed).
        /// </summary>
        public static RunManager GetRunManager()
        {
            if (RunManager == null && !IsInitialized)
            {
                Initialize();
            }
            return RunManager;
        }
        
        /// <summary>
        /// Reconfigures the analyzer with new settings at runtime.
        /// </summary>
        public static void Reconfigure(float targetWinRate, bool autoApply, int runsPerAnalysis)
        {
            if (Analyzer == null)
            {
                Debug.LogWarning("[AutoSetupAnalyzer] Cannot reconfigure - Analyzer not initialized.");
                return;
            }
            
            var config = new BalanceAnalyzer.Config
            {
                TargetWinRate = targetWinRate,
                WinRateTolerance = DEFAULT_WIN_RATE_TOLERANCE,
                AutoApplySuggestions = autoApply,
                MinSeverityForAutoApply = DEFAULT_MIN_SEVERITY,
                RunsPerAnalysis = runsPerAnalysis
            };
            
            Analyzer.SetConfig(config);
            
            Debug.Log("[AutoSetupAnalyzer] Configuration updated:");
            Debug.Log($"  - Target Win Rate: {targetWinRate}%");
            Debug.Log($"  - Auto-Apply: {autoApply}");
            Debug.Log($"  - Runs per Analysis: {runsPerAnalysis}");
        }
        
        /// <summary>
        /// Manually triggers initialization (if you need to run before scene load).
        /// </summary>
        public static void ForceInitialize()
        {
            if (!IsInitialized)
            {
                Initialize();
            }
        }
    }
}
