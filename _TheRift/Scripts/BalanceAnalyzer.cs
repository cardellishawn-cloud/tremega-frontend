using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace TheRift.Balance
{
    /// <summary>
    /// Tracks and analyzes game balance across multiple runs.
    /// Auto-tunes game parameters based on performance data.
    /// Attach to a persistent GameObject (e.g., GameManager).
    /// </summary>
    public class BalanceAnalyzer : MonoBehaviour
    {
        // ============ Data Structures ============
        
        [Serializable]
        public class RunData
        {
            public int RunNumber { get; set; }
            public int FloorReached { get; set; }
            public int MaxFloors { get; set; }
            public bool Success { get; set; }
            
            // Units
            public int UnitsAlive { get; set; }
            public int UnitsDead { get; set; }
            public int TotalUnits { get; set; }
            
            // Combat
            public float DamageTaken { get; set; }
            public float DamageDealt { get; set; }
            public int EnemiesKilled { get; set; }
            
            // Items
            public int ItemsEquipped { get; set; }
            public string ItemPowerRating { get; set; } = "average";
            
            // Shards
            public int ShardsEarned { get; set; }
            public int ShardsSpent { get; set; }
            public int ShardsRemaining { get; set; }
            
            // Additional context
            public List<string> Tags { get; set; } = new List<string>();
            public float RunDurationSeconds { get; set; }
            public DateTime Timestamp { get; set; }
            
            public override string ToString()
            {
                string result = Success ? $"Floor {FloorReached}: SUCCESS" : $"Floor {FloorReached}: Failed";
                result += $". Squad took {DamageTaken:F0} damage, killed {EnemiesKilled} enemies";
                return result;
            }
        }
        
        [Serializable]
        public class AnalysisResult
        {
            public int TotalRuns { get; set; }
            public int SuccessfulRuns { get; set; }
            public float WinRate => TotalRuns > 0 ? (float)SuccessfulRuns / TotalRuns * 100 : 0;
            
            public float AvgFloorReached { get; set; }
            public float AvgDamageTaken { get; set; }
            public float AvgDamageDealt { get; set; }
            public float AvgShardsEarned { get; set; }
            public float AvgShardsSpent { get; set; }
            public float AvgItemsEquipped { get; set; }
            public float AvgSurvivalRate { get; set; }
            
            public List<BalanceSuggestion> Suggestions { get; set; } = new List<BalanceSuggestion>();
        }
        
        [Serializable]
        public class BalanceSuggestion
        {
            public string Category { get; set; } = "";
            public string Issue { get; set; } = "";
            public string SuggestedChange { get; set; } = "";
            public float Severity { get; set; }
            public bool Applied { get; set; }
            
            public override string ToString() => $"[{Category}] {Issue} -> {SuggestedChange}";
        }
        
        // ============ Configuration ============
        
        [Serializable]
        public class Config
        {
            [Tooltip("Target win rate percentage for balanced gameplay")]
            [Range(30f, 70f)]
            public float TargetWinRate { get; set; } = 50f;
            
            [Tooltip("How far from target before adjustments are suggested")]
            [Range(5f, 20f)]
            public float WinRateTolerance { get; set; } = 10f;
            
            [Tooltip("Target percentage of max floors reached on average")]
            [Range(40f, 80f)]
            public float TargetAvgFloorPercent { get; set; } = 60f;
            
            [Tooltip("Target ratio of damage dealt to damage taken")]
            [Range(1f, 3f)]
            public float TargetDamageDealtToTakenRatio { get; set; } = 1.5f;
            
            [Tooltip("Target percentage of earned shards that should be spent")]
            [Range(50f, 90f)]
            public float TargetShardSpendRate { get; set; } = 75f;
            
            [Tooltip("Automatically apply balance suggestions when they meet severity threshold")]
            public bool AutoApplySuggestions { get; set; } = true;
            
            [Tooltip("Minimum severity (0-1) for auto-application")]
            [Range(0f, 1f)]
            public float MinSeverityForAutoApply { get; set; } = 0.3f;
            
            [Tooltip("Number of runs between analyses")]
            [Range(3, 20)]
            public int RunsPerAnalysis { get; set; } = 5;
        }
        
        // ============ Serialized Fields ============
        
        [SerializeField] private Config config = new Config();
        [SerializeField] private BalanceTuner balanceTuner = new BalanceTuner();
        [SerializeField] private List<RunData> runHistory = new List<RunData>();
        
        // ============ Public Properties ============
        
        public Config Configuration => config;
        public BalanceTuner Tuner => balanceTuner;
        public IReadOnlyList<RunData> Runs => runHistory.AsReadOnly();
        
        public int TotalRuns => runHistory.Count;
        public int SuccessfulRuns => runHistory.Count(r => r.Success);
        public float CurrentWinRate => TotalRuns > 0 ? (float)SuccessfulRuns / TotalRuns * 100 : 0;
        
        public AnalysisResult LastAnalysis { get; private set; }
        public List<BalanceSuggestion> PendingSuggestions { get; private set; } = new List<BalanceSuggestion>();
        
        // ============ Events ============
        
        public event Action<RunData> OnRunLogged;
        public event Action<AnalysisResult> OnAnalysisComplete;
        public event Action<BalanceSuggestion> OnSuggestionGenerated;
        public event Action<BalanceSuggestion> OnSuggestionApplied;
        
        // ============ Unity Lifecycle ============
        
        private void Awake()
        {
            // Ensure BalanceTuner is initialized
            if (balanceTuner == null)
            {
                balanceTuner = new BalanceTuner();
            }
            
            Debug.Log($"[BalanceAnalyzer] Initialized. Target Win Rate: {config.TargetWinRate}%, AutoApply: {config.AutoApplySuggestions}");
        }
        
        private void Start()
        {
            Debug.Log($"[BalanceAnalyzer] Ready. Total runs recorded: {TotalRuns}");
        }
        
        // ============ Run Tracking ============
        
        /// <summary>
        /// Records a completed run and logs the summary.
        /// Call this from RunManager when a run ends.
        /// </summary>
        public void LogRun(RunData run)
        {
            run.RunNumber = runHistory.Count + 1;
            run.Timestamp = DateTime.Now;
            runHistory.Add(run);
            
            // Log summary
            LogRunSummary(run);
            
            OnRunLogged?.Invoke(run);
            
            // Check if we should analyze
            if (TotalRuns % config.RunsPerAnalysis == 0)
            {
                var analysis = AnalyzeLastRuns(config.RunsPerAnalysis);
                
                if (config.AutoApplySuggestions)
                {
                    ApplySuggestions(analysis);
                }
            }
        }
        
        /// <summary>
        /// Creates and logs a run from individual values (convenience method).
        /// </summary>
        public void LogRun(
            int floorReached, 
            int maxFloors, 
            bool success,
            int unitsAlive,
            int unitsDead,
            int totalUnits,
            float damageTaken,
            float damageDealt,
            int enemiesKilled,
            int itemsEquipped,
            string itemPowerRating,
            int shardsEarned,
            int shardsSpent,
            float runDurationSeconds = 0f,
            List<string> tags = null)
        {
            var run = new RunData
            {
                FloorReached = floorReached,
                MaxFloors = maxFloors,
                Success = success,
                UnitsAlive = unitsAlive,
                UnitsDead = unitsDead,
                TotalUnits = totalUnits,
                DamageTaken = damageTaken,
                DamageDealt = damageDealt,
                EnemiesKilled = enemiesKilled,
                ItemsEquipped = itemsEquipped,
                ItemPowerRating = itemPowerRating ?? "average",
                ShardsEarned = shardsEarned,
                ShardsSpent = shardsSpent,
                ShardsRemaining = shardsEarned - shardsSpent,
                RunDurationSeconds = runDurationSeconds,
                Tags = tags ?? new List<string>()
            };
            
            LogRun(run);
        }
        
        private void LogRunSummary(RunData run)
        {
            Debug.Log($"[BalanceAnalyzer] Run #{run.RunNumber} Summary: {run}");
            Debug.Log($"  Units: {run.UnitsAlive}/{run.TotalUnits} alive ({run.UnitsDead} dead)");
            Debug.Log($"  Damage: {run.DamageDealt:F0} dealt vs {run.DamageTaken:F0} taken");
            Debug.Log($"  Shards: {run.ShardsEarned} earned, {run.ShardsSpent} spent");
            Debug.Log($"  Items: {run.ItemsEquipped} equipped, felt {run.ItemPowerRating}");
            
            if (run.Tags.Count > 0)
            {
                Debug.Log($"  Tags: {string.Join(", ", run.Tags)}");
            }
        }
        
        // ============ Analysis ============
        
        /// <summary>
        /// Analyzes the last N runs and generates balance suggestions.
        /// Returns the analysis result with suggestions.
        /// </summary>
        public AnalysisResult AnalyzeLastRuns(int count)
        {
            var recentRuns = runHistory.TakeLast(count).ToList();
            var analysis = new AnalysisResult
            {
                TotalRuns = recentRuns.Count,
                SuccessfulRuns = recentRuns.Count(r => r.Success)
            };
            
            if (recentRuns.Count == 0)
            {
                Debug.LogWarning("[BalanceAnalyzer] No runs to analyze.");
                return analysis;
            }
            
            // Calculate averages
            analysis.AvgFloorReached = recentRuns.Average(r => (float)r.FloorReached / r.MaxFloors * 100);
            analysis.AvgDamageTaken = recentRuns.Average(r => r.DamageTaken);
            analysis.AvgDamageDealt = recentRuns.Average(r => r.DamageDealt);
            analysis.AvgShardsEarned = recentRuns.Average(r => r.ShardsEarned);
            analysis.AvgShardsSpent = recentRuns.Average(r => r.ShardsSpent);
            analysis.AvgItemsEquipped = recentRuns.Average(r => r.ItemsEquipped);
            analysis.AvgSurvivalRate = recentRuns.Average(r => r.TotalUnits > 0 ? (float)r.UnitsAlive / r.TotalUnits * 100 : 0);
            
            // Generate suggestions
            analysis.Suggestions = GenerateSuggestions(analysis, recentRuns);
            PendingSuggestions = analysis.Suggestions;
            
            // Log analysis
            Debug.Log($"[BalanceAnalyzer] ========== Analysis of Last {count} Runs ==========");
            Debug.Log($"[BalanceAnalyzer] Win Rate: {analysis.WinRate:F1}% ({analysis.SuccessfulRuns}/{analysis.TotalRuns})");
            Debug.Log($"[BalanceAnalyzer] Avg Floor Reached: {analysis.AvgFloorReached:F1}%");
            Debug.Log($"[BalanceAnalyzer] Avg Damage: {analysis.AvgDamageDealt:F0} dealt vs {analysis.AvgDamageTaken:F0} taken");
            Debug.Log($"[BalanceAnalyzer] Avg Shards: {analysis.AvgShardsEarned:F0} earned, {analysis.AvgShardsSpent:F0} spent");
            Debug.Log($"[BalanceAnalyzer] Avg Items: {analysis.AvgItemsEquipped:F1} equipped");
            Debug.Log($"[BalanceAnalyzer] Avg Survival: {analysis.AvgSurvivalRate:F1}% units alive");
            
            if (analysis.Suggestions.Count > 0)
            {
                Debug.Log($"[BalanceAnalyzer] --- Balance Suggestions ---");
                foreach (var suggestion in analysis.Suggestions)
                {
                    Debug.Log($"[BalanceAnalyzer] {suggestion}");
                }
            }
            else
            {
                Debug.Log($"[BalanceAnalyzer] (No balance changes needed - game feels balanced!)");
            }
            
            LastAnalysis = analysis;
            OnAnalysisComplete?.Invoke(analysis);
            return analysis;
        }
        
        /// <summary>
        /// Gets current suggestions without re-running analysis.
        /// </summary>
        public List<BalanceSuggestion> GetSuggestions()
        {
            if (PendingSuggestions.Count == 0 && TotalRuns >= config.RunsPerAnalysis)
            {
                AnalyzeLastRuns(config.RunsPerAnalysis);
            }
            return PendingSuggestions;
        }
        
        /// <summary>
        /// Gets the first unapplied suggestion or null.
        /// </summary>
        public BalanceSuggestion GetCurrentSuggestion()
        {
            return PendingSuggestions.FirstOrDefault(s => !s.Applied);
        }
        
        private List<BalanceSuggestion> GenerateSuggestions(AnalysisResult analysis, List<RunData> runs)
        {
            var suggestions = new List<BalanceSuggestion>();
            
            // Win rate analysis
            if (analysis.WinRate < config.TargetWinRate - config.WinRateTolerance)
            {
                float deficit = config.TargetWinRate - analysis.WinRate;
                float adjustment = Mathf.Min(deficit, 20f);
                
                suggestions.Add(new BalanceSuggestion
                {
                    Category = "Difficulty",
                    Issue = $"Win rate {analysis.WinRate:F0}% too low",
                    SuggestedChange = $"Lower enemy health by {adjustment:F0}%",
                    Severity = deficit / 100f
                });
            }
            else if (analysis.WinRate > config.TargetWinRate + config.WinRateTolerance)
            {
                float excess = analysis.WinRate - config.TargetWinRate;
                float adjustment = Mathf.Min(excess, 20f);
                
                suggestions.Add(new BalanceSuggestion
                {
                    Category = "Difficulty",
                    Issue = $"Win rate {analysis.WinRate:F0}% too high",
                    SuggestedChange = $"Increase enemy health by {adjustment:F0}%",
                    Severity = excess / 100f
                });
            }
            
            // Shard economy
            float avgSpendRate = analysis.AvgShardsEarned > 0 
                ? analysis.AvgShardsSpent / analysis.AvgShardsEarned * 100 
                : 0;
            
            if (avgSpendRate < config.TargetShardSpendRate - 15)
            {
                float increase = (config.TargetShardSpendRate - avgSpendRate) / 2;
                suggestions.Add(new BalanceSuggestion
                {
                    Category = "Economy",
                    Issue = $"Shards too scarce - only spending {avgSpendRate:F0}%",
                    SuggestedChange = $"Increase shard generation by {increase:F0}%",
                    Severity = (config.TargetShardSpendRate - avgSpendRate) / 100f
                });
            }
            else if (avgSpendRate > config.TargetShardSpendRate + 15 && analysis.AvgShardsEarned > 0)
            {
                float decrease = (avgSpendRate - config.TargetShardSpendRate) / 2;
                suggestions.Add(new BalanceSuggestion
                {
                    Category = "Economy",
                    Issue = $"Shards too abundant - spending {avgSpendRate:F0}%",
                    SuggestedChange = $"Decrease shard generation by {decrease:F0}%",
                    Severity = (avgSpendRate - config.TargetShardSpendRate) / 100f
                });
            }
            
            // Item power
            int weakRuns = runs.Count(r => r.ItemPowerRating == "weak");
            int strongRuns = runs.Count(r => r.ItemPowerRating == "strong");
            
            if ((float)weakRuns / runs.Count > 0.4f)
            {
                suggestions.Add(new BalanceSuggestion
                {
                    Category = "Items",
                    Issue = $"Items felt weak in {weakRuns}/{runs.Count} runs",
                    SuggestedChange = "Increase item power by 1.5x",
                    Severity = 0.5f
                });
            }
            else if ((float)strongRuns / runs.Count > 0.6f)
            {
                suggestions.Add(new BalanceSuggestion
                {
                    Category = "Items",
                    Issue = $"Items felt too strong in {strongRuns}/{runs.Count} runs",
                    SuggestedChange = "Decrease item power by 0.8x",
                    Severity = 0.4f
                });
            }
            
            // Damage ratio
            float avgRatio = analysis.AvgDamageTaken > 0 
                ? analysis.AvgDamageDealt / analysis.AvgDamageTaken 
                : 0;
            
            if (avgRatio < config.TargetDamageDealtToTakenRatio * 0.7f)
            {
                suggestions.Add(new BalanceSuggestion
                {
                    Category = "Combat",
                    Issue = $"Damage ratio {avgRatio:F2} too low",
                    SuggestedChange = "Increase player damage by 15%",
                    Severity = 0.4f
                });
            }
            
            // Survival rate
            if (analysis.AvgSurvivalRate < 30)
            {
                suggestions.Add(new BalanceSuggestion
                {
                    Category = "Survivability",
                    Issue = $"Only {analysis.AvgSurvivalRate:F0}% units surviving",
                    SuggestedChange = "Reduce enemy damage by 12%",
                    Severity = (50 - analysis.AvgSurvivalRate) / 100f
                });
            }
            
            foreach (var suggestion in suggestions)
            {
                OnSuggestionGenerated?.Invoke(suggestion);
            }
            
            return suggestions;
        }
        
        // ============ Auto-Apply ============
        
        private void ApplySuggestions(AnalysisResult analysis)
        {
            foreach (var suggestion in analysis.Suggestions)
            {
                if (suggestion.Severity >= config.MinSeverityForAutoApply)
                {
                    Debug.Log($"[BalanceAnalyzer] [Auto-Apply] {suggestion}");
                    balanceTuner.ApplySuggestion(suggestion);
                    suggestion.Applied = true;
                    OnSuggestionApplied?.Invoke(suggestion);
                }
                else
                {
                    Debug.Log($"[BalanceAnalyzer] [Skipped - Low Severity] {suggestion}");
                }
            }
            
            if (analysis.Suggestions.Count > 0)
            {
                Debug.Log($"[BalanceAnalyzer] --- Current Balance Parameters ---");
                Debug.Log(balanceTuner.GetStatus());
            }
        }
        
        /// <summary>
        /// Manually applies a specific suggestion.
        /// </summary>
        public void ApplySuggestion(BalanceSuggestion suggestion)
        {
            balanceTuner.ApplySuggestion(suggestion);
            suggestion.Applied = true;
            OnSuggestionApplied?.Invoke(suggestion);
        }
        
        // ============ Utility ============
        
        /// <summary>
        /// Clears all run history.
        /// </summary>
        public void ClearHistory()
        {
            runHistory.Clear();
            PendingSuggestions.Clear();
            Debug.Log("[BalanceAnalyzer] Run history cleared.");
        }
        
        /// <summary>
        /// Gets analysis of all runs.
        /// </summary>
        public AnalysisResult GetFullAnalysis()
        {
            return AnalyzeLastRuns(TotalRuns);
        }
        
        /// <summary>
        /// Updates the configuration.
        /// </summary>
        public void SetConfig(Config newConfig)
        {
            config = newConfig;
            Debug.Log($"[BalanceAnalyzer] Config updated. Target Win Rate: {config.TargetWinRate}%");
        }
    }
    
    // ============ BalanceTuner ============
    
    /// <summary>
    /// Serializable class that holds and adjusts game balance parameters.
    /// </summary>
    [Serializable]
    public class BalanceTuner
    {
        [Serializable]
        public class BalanceParameters
        {
            // BOOSTED ECONOMY - Items feel ABUNDANT and POWERFUL
            // Players can survive past floor 3, then BalanceAnalyzer fine-tunes from there
            
            [Header("Enemy Stats")]
            [Range(0.1f, 5f)] public float EnemyHealthMultiplier = 0.70f;      // BOOSTED: enemies weaker (was 1.0)
            [Range(0.1f, 5f)] public float EnemyDamageMultiplier = 1.0f;
            [Range(0.1f, 3f)] public float EnemySpawnRate = 1.0f;
            
            [Header("Player Stats")]
            [Range(0.1f, 5f)] public float PlayerDamageMultiplier = 1.0f;
            [Range(0.1f, 5f)] public float PlayerHealthMultiplier = 1.0f;
            
            [Header("Economy - BOOSTED")]
            [Range(0.1f, 5f)] public float ShardGenerationMultiplier = 1.5f;     // BOOSTED: +50% shards per floor (was 1.0)
            [Range(0.1f, 3f)] public float ItemCostMultiplier = 0.80f;            // BOOSTED: items 20% cheaper (was 1.0)
            
            [Header("Items - BOOSTED")]
            [Range(0.1f, 5f)] public float ItemPowerMultiplier = 2.0f;         // BOOSTED: items hit 2x harder (was 1.0)
            [Range(0.1f, 3f)] public float ItemDropRate = 1.5f;                  // BOOSTED: +50% more item drops (was 1.0)
            
            [Header("Progression")]
            [Range(0.5f, 3f)] public float FloorDifficultyRamp = 0.85f;         // BOOSTED: slower ramp (was 1.0)
            [Range(0.1f, 3f)] public float HealingEfficiency = 1.2f;            // BOOSTED: healing more effective (was 1.0)
            
            public BalanceParameters Clone()
            {
                return new BalanceParameters
                {
                    EnemyHealthMultiplier = EnemyHealthMultiplier,
                    EnemyDamageMultiplier = EnemyDamageMultiplier,
                    EnemySpawnRate = EnemySpawnRate,
                    PlayerDamageMultiplier = PlayerDamageMultiplier,
                    PlayerHealthMultiplier = PlayerHealthMultiplier,
                    ShardGenerationMultiplier = ShardGenerationMultiplier,
                    ItemCostMultiplier = ItemCostMultiplier,
                    ItemPowerMultiplier = ItemPowerMultiplier,
                    ItemDropRate = ItemDropRate,
                    FloorDifficultyRamp = FloorDifficultyRamp,
                    HealingEfficiency = HealingEfficiency
                };
            }
        }
        
        [SerializeField] private BalanceParameters parameters = new BalanceParameters();
        
        private Stack<BalanceParameters> history = new Stack<BalanceParameters>();
        
        public BalanceParameters Parameters => parameters;
        public IReadOnlyCollection<BalanceParameters> History => history;
        public int ChangeCount => history.Count;
        
        /// <summary>
        /// Applies a balance suggestion to the current parameters.
        /// </summary>
        public void ApplySuggestion(BalanceAnalyzer.BalanceSuggestion suggestion)
        {
            history.Push(parameters.Clone());
            
            string change = suggestion.SuggestedChange.ToLowerInvariant();
            
            if (change.Contains("enemy health"))
            {
                float factor = ExtractMultiplier(change);
                if (change.Contains("lower") || change.Contains("decrease"))
                {
                    parameters.EnemyHealthMultiplier *= (1 - factor / 100);
                }
                else
                {
                    parameters.EnemyHealthMultiplier *= (1 + factor / 100);
                }
            }
            else if (change.Contains("enemy damage"))
            {
                float factor = ExtractMultiplier(change);
                if (change.Contains("lower") || change.Contains("decrease") || change.Contains("reduce"))
                {
                    parameters.EnemyDamageMultiplier *= (1 - factor / 100);
                }
                else
                {
                    parameters.EnemyDamageMultiplier *= (1 + factor / 100);
                }
            }
            else if (change.Contains("shard"))
            {
                float factor = ExtractMultiplier(change);
                if (change.Contains("increase"))
                {
                    parameters.ShardGenerationMultiplier *= (1 + factor / 100);
                }
                else
                {
                    parameters.ShardGenerationMultiplier *= (1 - factor / 100);
                }
            }
            else if (change.Contains("item power"))
            {
                float factor = ExtractMultiplier(change);
                if (change.Contains("decrease"))
                {
                    parameters.ItemPowerMultiplier *= 0.8f;
                }
                else
                {
                    parameters.ItemPowerMultiplier *= 1.5f;
                }
            }
            else if (change.Contains("player damage"))
            {
                float factor = ExtractMultiplier(change);
                parameters.PlayerDamageMultiplier *= (1 + factor / 100);
            }
            
            ClampParameters();
            
            Debug.Log($"[BalanceTuner] Applied: {suggestion.SuggestedChange}");
        }
        
        private float ExtractMultiplier(string text)
        {
            var matches = System.Text.RegularExpressions.Regex.Matches(text, @"\d+\.?\d*");
            if (matches.Count > 0 && float.TryParse(matches[0].Value, out float value))
            {
                return value;
            }
            return 10f;
        }
        
        private void ClampParameters()
        {
            parameters.EnemyHealthMultiplier = Mathf.Clamp(parameters.EnemyHealthMultiplier, 0.1f, 5f);
            parameters.EnemyDamageMultiplier = Mathf.Clamp(parameters.EnemyDamageMultiplier, 0.1f, 5f);
            parameters.PlayerDamageMultiplier = Mathf.Clamp(parameters.PlayerDamageMultiplier, 0.1f, 5f);
            parameters.ShardGenerationMultiplier = Mathf.Clamp(parameters.ShardGenerationMultiplier, 0.1f, 5f);
            parameters.ItemPowerMultiplier = Mathf.Clamp(parameters.ItemPowerMultiplier, 0.1f, 5f);
        }
        
        /// <summary>
        /// Sets parameters directly (used for initial boost setup).
        /// </summary>
        public void SetParameters(BalanceParameters newParameters)
        {
            history.Push(parameters.Clone());
            parameters = newParameters.Clone();
            Debug.Log("[BalanceTuner] Parameters set directly.");
        }
        
        /// <summary>
        /// Reverts the last applied change.
        /// </summary>
        public bool UndoLastChange()
        {
            if (history.Count > 0)
            {
                parameters = history.Pop();
                Debug.Log("[BalanceTuner] Last change undone.");
                return true;
            }
            return false;
        }
        
        /// <summary>
        /// Gets a formatted status of current parameters.
        /// </summary>
        public string GetStatus()
        {
            return $"Enemy Health: {parameters.EnemyHealthMultiplier:F2}x\n" +
                   $"Enemy Damage: {parameters.EnemyDamageMultiplier:F2}x\n" +
                   $"Player Damage: {parameters.PlayerDamageMultiplier:F2}x\n" +
                   $"Shard Gen: {parameters.ShardGenerationMultiplier:F2}x\n" +
                   $"Item Power: {parameters.ItemPowerMultiplier:F2}x\n" +
                   $"Changes Applied: {history.Count}";
        }
        
        /// <summary>
        /// Resets all parameters to defaults.
        /// </summary>
        public void Reset()
        {
            history.Push(parameters.Clone());
            parameters = new BalanceParameters();
            Debug.Log("[BalanceTuner] Parameters reset to defaults.");
        }
    }
}
