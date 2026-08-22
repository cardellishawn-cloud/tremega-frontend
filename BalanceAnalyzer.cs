using System;
using System.Collections.Generic;
using System.Linq;

/// <summary>
/// Tracks and analyzes game balance across multiple runs.
/// Auto-tunes game parameters based on performance data.
/// </summary>
public class BalanceAnalyzer
{
    // ============ Data Structures ============
    
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
        
        public override string ToString()
        {
            string result = Success ? $"Floor {FloorReached}: SUCCESS" : $"Floor {FloorReached}: Failed";
            result += $". Squad took {DamageTaken:F0} damage, killed {EnemiesKilled} enemies";
            return result;
        }
    }
    
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
    
    public class BalanceSuggestion
    {
        public string Category { get; set; } = "";
        public string Issue { get; set; } = "";
        public string SuggestedChange { get; set; } = "";
        public float Severity { get; set; } // 0-1 scale
        
        public override string ToString() => $"[{Category}] {Issue} -> {SuggestedChange}";
    }
    
    // ============ Configuration ============
    
    public class Config
    {
        // Target win rate for balance (40-60% is typically good)
        public float TargetWinRate { get; set; } = 50f;
        public float WinRateTolerance { get; set; } = 10f;
        
        // Target average floor reached (for failed runs)
        public float TargetAvgFloorPercent { get; set; } = 60f;
        
        // Damage ratios
        public float TargetDamageDealtToTakenRatio { get; set; } = 1.5f;
        
        // Shard spending (want players to spend most of what they earn)
        public float TargetShardSpendRate { get; set; } = 75f;
        
        // Items should feel impactful
        public float MinItemPowerRatingThreshold { get; set; } = 0.4f;
        
        // Auto-apply thresholds
        public bool AutoApplySuggestions { get; set; } = true;
        public float MinSeverityForAutoApply { get; set; } = 0.3f;
    }
    
    // ============ State ============
    
    private List<RunData> _runs = new List<RunData>();
    private Config _config;
    private BalanceTuner _tuner;
    
    public IReadOnlyList<RunData> Runs => _runs.AsReadOnly();
    public Config Configuration => _config;
    public BalanceTuner Tuner => _tuner;
    
    // Events
    public event Action<RunData>? OnRunLogged;
    public event Action<AnalysisResult>? OnAnalysisComplete;
    public event Action<BalanceSuggestion>? OnSuggestionGenerated;
    public event Action<BalanceSuggestion>? OnSuggestionApplied;
    
    // ============ Constructor ============
    
    public BalanceAnalyzer(Config? config = null)
    {
        _config = config ?? new Config();
        _tuner = new BalanceTuner();
    }
    
    // ============ Run Tracking ============
    
    /// <summary>
    /// Records a completed run and logs the summary.
    /// </summary>
    public void LogRun(RunData run)
    {
        run.RunNumber = _runs.Count + 1;
        _runs.Add(run);
        
        // Log summary
        LogRunSummary(run);
        
        OnRunLogged?.Invoke(run);
        
        // Check if we should analyze (every 5 runs)
        if (_runs.Count % 5 == 0)
        {
            var analysis = AnalyzeLastRuns(5);
            
            if (_config.AutoApplySuggestions)
            {
                ApplySuggestions(analysis);
            }
        }
    }
    
    private void LogRunSummary(RunData run)
    {
        Console.WriteLine($"\n=== Run #{run.RunNumber} Summary ===");
        Console.WriteLine(run.ToString());
        Console.WriteLine($"  Units: {run.UnitsAlive}/{run.TotalUnits} alive ({run.UnitsDead} dead)");
        Console.WriteLine($"  Damage: {run.DamageDealt:F0} dealt vs {run.DamageTaken:F0} taken (ratio: {(run.DamageTaken > 0 ? run.DamageDealt/run.DamageTaken : 0):F2})");
        Console.WriteLine($"  Shards: {run.ShardsEarned} earned, {run.ShardsSpent} spent ({run.ShardsRemaining} remaining)");
        Console.WriteLine($"  Items: {run.ItemsEquipped} equipped, felt {run.ItemPowerRating}");
        
        if (run.Tags.Count > 0)
        {
            Console.WriteLine($"  Tags: {string.Join(", ", run.Tags)}");
        }
    }
    
    // ============ Analysis ============
    
    /// <summary>
    /// Analyzes the last N runs and generates balance suggestions.
    /// </summary>
    public AnalysisResult AnalyzeLastRuns(int count)
    {
        var recentRuns = _runs.TakeLast(count).ToList();
        var analysis = new AnalysisResult
        {
            TotalRuns = recentRuns.Count,
            SuccessfulRuns = recentRuns.Count(r => r.Success)
        };
        
        if (recentRuns.Count == 0) return analysis;
        
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
        
        Console.WriteLine($"\n========== Analysis of Last {count} Runs ==========");
        Console.WriteLine($"Win Rate: {analysis.WinRate:F1}% ({analysis.SuccessfulRuns}/{analysis.TotalRuns})");
        Console.WriteLine($"Avg Floor Reached: {analysis.AvgFloorReached:F1}%");
        Console.WriteLine($"Avg Damage: {analysis.AvgDamageDealt:F0} dealt vs {analysis.AvgDamageTaken:F0} taken");
        Console.WriteLine($"Avg Shards: {analysis.AvgShardsEarned:F0} earned, {analysis.AvgShardsSpent:F0} spent");
        Console.WriteLine($"Avg Items: {analysis.AvgItemsEquipped:F1} equipped");
        Console.WriteLine($"Avg Survival: {analysis.AvgSurvivalRate:F1}% units alive");
        
        if (analysis.Suggestions.Count > 0)
        {
            Console.WriteLine($"\n--- Balance Suggestions ---");
            foreach (var suggestion in analysis.Suggestions)
            {
                Console.WriteLine($"  {suggestion}");
            }
        }
        else
        {
            Console.WriteLine($"\n  (No balance changes needed - game feels balanced!)");
        }
        
        OnAnalysisComplete?.Invoke(analysis);
        return analysis;
    }
    
    private List<BalanceSuggestion> GenerateSuggestions(AnalysisResult analysis, List<RunData> runs)
    {
        var suggestions = new List<BalanceSuggestion>();
        
        // Win rate analysis
        if (analysis.WinRate < _config.TargetWinRate - _config.WinRateTolerance)
        {
            float deficit = _config.TargetWinRate - analysis.WinRate;
            float adjustment = Math.Min(deficit, 20f); // Cap at 20%
            
            suggestions.Add(new BalanceSuggestion
            {
                Category = "Difficulty",
                Issue = $"Win rate {analysis.WinRate:F0}% too low (target {_config.TargetWinRate:F0}%)",
                SuggestedChange = $"Lower enemy health by {adjustment:F0}%",
                Severity = deficit / 100f
            });
        }
        else if (analysis.WinRate > _config.TargetWinRate + _config.WinRateTolerance)
        {
            float excess = analysis.WinRate - _config.TargetWinRate;
            float adjustment = Math.Min(excess, 20f);
            
            suggestions.Add(new BalanceSuggestion
            {
                Category = "Difficulty",
                Issue = $"Win rate {analysis.WinRate:F0}% too high (target {_config.TargetWinRate:F0}%)",
                SuggestedChange = $"Increase enemy health by {adjustment:F0}%",
                Severity = excess / 100f
            });
        }
        
        // Shard economy
        float avgSpendRate = analysis.AvgShardsEarned > 0 
            ? analysis.AvgShardsSpent / analysis.AvgShardsEarned * 100 
            : 0;
        
        if (avgSpendRate < _config.TargetShardSpendRate - 15)
        {
            float increase = (_config.TargetShardSpendRate - avgSpendRate) / 2;
            suggestions.Add(new BalanceSuggestion
            {
                Category = "Economy",
                Issue = $"Shards too scarce - only spending {avgSpendRate:F0}% of earnings",
                SuggestedChange = $"Increase shard generation by {increase:F0}%",
                Severity = (_config.TargetShardSpendRate - avgSpendRate) / 100f
            });
        }
        else if (avgSpendRate > _config.TargetShardSpendRate + 15 && analysis.AvgShardsEarned > 0)
        {
            float decrease = (avgSpendRate - _config.TargetShardSpendRate) / 2;
            suggestions.Add(new BalanceSuggestion
            {
                Category = "Economy",
                Issue = $"Shards too abundant - spending {avgSpendRate:F0}% of earnings",
                SuggestedChange = $"Decrease shard generation by {decrease:F0}%",
                Severity = (avgSpendRate - _config.TargetShardSpendRate) / 100f
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
                SuggestedChange = "Increase item power multiplier by 1.5x",
                Severity = 0.5f
            });
        }
        else if ((float)strongRuns / runs.Count > 0.6f)
        {
            suggestions.Add(new BalanceSuggestion
            {
                Category = "Items",
                Issue = $"Items felt too strong in {strongRuns}/{runs.Count} runs",
                SuggestedChange = "Decrease item power multiplier by 0.8x",
                Severity = 0.4f
            });
        }
        
        // Damage ratio
        float avgRatio = analysis.AvgDamageTaken > 0 
            ? analysis.AvgDamageDealt / analysis.AvgDamageTaken 
            : 0;
        
        if (avgRatio < _config.TargetDamageDealtToTakenRatio * 0.7f)
        {
            suggestions.Add(new BalanceSuggestion
            {
                Category = "Combat",
                Issue = $"Damage ratio {avgRatio:F2} too low (dealing less than taking)",
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
                Issue = $"Only {analysis.AvgSurvivalRate:F0}% units surviving on average",
                SuggestedChange = "Reduce enemy damage by 12%",
                Severity = (50 - analysis.AvgSurvivalRate) / 100f
            });
        }
        
        return suggestions;
    }
    
    // ============ Auto-Apply ============
    
    private void ApplySuggestions(AnalysisResult analysis)
    {
        foreach (var suggestion in analysis.Suggestions)
        {
            if (suggestion.Severity >= _config.MinSeverityForAutoApply)
            {
                Console.WriteLine($"\n[Auto-Apply] {suggestion}");
                _tuner.ApplySuggestion(suggestion);
                OnSuggestionApplied?.Invoke(suggestion);
            }
            else
            {
                Console.WriteLine($"\n[Skipped - Low Severity] {suggestion}");
            }
        }
        
        if (analysis.Suggestions.Count > 0)
        {
            Console.WriteLine($"\n--- Current Balance Parameters ---");
            Console.WriteLine(_tuner.GetStatus());
        }
    }
    
    // ============ Test Loop ============
    
    /// <summary>
    /// Runs the full test cycle: 5 runs, analyze/tune, 5 more runs.
    /// </summary>
    public void RunFullTestCycle(Func<BalanceParameters, RunData> runSimulator)
    {
        Console.WriteLine("\n" + new string('=', 50));
        Console.WriteLine("BALANCE ANALYZER - FULL TEST CYCLE");
        Console.WriteLine(new string('=', 50));
        Console.WriteLine($"Initial Parameters:\n{_tuner.GetStatus()}");
        
        // Phase 1: Initial 5 runs
        Console.WriteLine("\n>>> PHASE 1: Running 5 tests with current balance...");
        for (int i = 0; i < 5; i++)
        {
            var run = runSimulator(_tuner.Parameters);
            LogRun(run);
        }
        
        // Phase 2: Analyze and tune (happens automatically in LogRun every 5 runs)
        Console.WriteLine("\n>>> PHASE 2: Balance tuning applied based on analysis");
        
        // Phase 3: 5 more runs with new values
        Console.WriteLine("\n>>> PHASE 3: Running 5 tests with updated balance...");
        for (int i = 0; i < 5; i++)
        {
            var run = runSimulator(_tuner.Parameters);
            LogRun(run);
        }
        
        // Final analysis
        Console.WriteLine("\n" + new string('=', 50));
        Console.WriteLine("FINAL ANALYSIS (All 10 Runs)");
        Console.WriteLine(new string('=', 50));
        var finalAnalysis = AnalyzeLastRuns(10);
        
        Console.WriteLine($"\nFinal Parameters:\n{_tuner.GetStatus()}");
    }
    
    /// <summary>
    /// Clears all run history.
    /// </summary>
    public void ClearHistory()
    {
        _runs.Clear();
        Console.WriteLine("Run history cleared.");
    }
    
    /// <summary>
    /// Gets analysis of all runs.
    /// </summary>
    public AnalysisResult GetFullAnalysis()
    {
        return AnalyzeLastRuns(_runs.Count);
    }
}

// ============ BalanceTuner ============

/// <summary>
/// Holds and adjusts game balance parameters.
/// Can apply suggested changes automatically.
/// </summary>
public class BalanceTuner
{
    public class BalanceParameters
    {
        // Enemy stats
        public float EnemyHealthMultiplier { get; set; } = 1.0f;
        public float EnemyDamageMultiplier { get; set; } = 1.0f;
        public float EnemySpawnRate { get; set; } = 1.0f;
        
        // Player stats
        public float PlayerDamageMultiplier { get; set; } = 1.0f;
        public float PlayerHealthMultiplier { get; set; } = 1.0f;
        
        // Economy
        public float ShardGenerationMultiplier { get; set; } = 1.0f;
        public float ItemCostMultiplier { get; set; } = 1.0f;
        
        // Items
        public float ItemPowerMultiplier { get; set; } = 1.0f;
        public float ItemDropRate { get; set; } = 1.0f;
        
        // Progression
        public float FloorDifficultyRamp { get; set; } = 1.0f;
        public float HealingEfficiency { get; set; } = 1.0f;
        
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
    
    private BalanceParameters _parameters = new BalanceParameters();
    private Stack<BalanceParameters> _history = new Stack<BalanceParameters>();
    
    public BalanceParameters Parameters => _parameters;
    public IReadOnlyCollection<BalanceParameters> History => _history;
    
    /// <summary>
    /// Applies a balance suggestion to the current parameters.
    /// </summary>
    public void ApplySuggestion(BalanceAnalyzer.BalanceSuggestion suggestion)
    {
        // Save current state to history
        _history.Push(_parameters.Clone());
        
        string change = suggestion.SuggestedChange.ToLowerInvariant();
        
        // Parse and apply the change
        if (change.Contains("enemy health"))
        {
            float factor = ExtractMultiplier(change);
            if (change.Contains("lower") || change.Contains("decrease"))
            {
                _parameters.EnemyHealthMultiplier *= (1 - factor / 100);
            }
            else
            {
                _parameters.EnemyHealthMultiplier *= (1 + factor / 100);
            }
        }
        else if (change.Contains("enemy damage"))
        {
            float factor = ExtractMultiplier(change);
            if (change.Contains("lower") || change.Contains("decrease") || change.Contains("reduce"))
            {
                _parameters.EnemyDamageMultiplier *= (1 - factor / 100);
            }
            else
            {
                _parameters.EnemyDamageMultiplier *= (1 + factor / 100);
            }
        }
        else if (change.Contains("shard"))
        {
            float factor = ExtractMultiplier(change);
            if (change.Contains("increase"))
            {
                _parameters.ShardGenerationMultiplier *= (1 + factor / 100);
            }
            else
            {
                _parameters.ShardGenerationMultiplier *= (1 - factor / 100);
            }
        }
        else if (change.Contains("item power"))
        {
            float factor = ExtractMultiplier(change);
            if (change.Contains("decrease"))
            {
                _parameters.ItemPowerMultiplier *= factor; // factor is like 0.8
            }
            else
            {
                _parameters.ItemPowerMultiplier *= factor; // factor is like 1.5
            }
        }
        else if (change.Contains("player damage"))
        {
            float factor = ExtractMultiplier(change);
            _parameters.PlayerDamageMultiplier *= (1 + factor / 100);
        }
        
        // Clamp values to reasonable ranges
        ClampParameters();
        
        Console.WriteLine($"  Applied: {suggestion.SuggestedChange}");
    }
    
    private float ExtractMultiplier(string text)
    {
        // Try to extract numbers from text like "10%", "1.5x", etc.
        var numbers = System.Text.RegularExpressions.Regex.Matches(text, @"\d+\.?\d*");
        if (numbers.Count > 0 && float.TryParse(numbers[0].Value, out float value))
        {
            return value;
        }
        return 10f; // Default 10%
    }
    
    private void ClampParameters()
    {
        _parameters.EnemyHealthMultiplier = Clamp(_parameters.EnemyHealthMultiplier, 0.1f, 5f);
        _parameters.EnemyDamageMultiplier = Clamp(_parameters.EnemyDamageMultiplier, 0.1f, 5f);
        _parameters.PlayerDamageMultiplier = Clamp(_parameters.PlayerDamageMultiplier, 0.1f, 5f);
        _parameters.ShardGenerationMultiplier = Clamp(_parameters.ShardGenerationMultiplier, 0.1f, 5f);
        _parameters.ItemPowerMultiplier = Clamp(_parameters.ItemPowerMultiplier, 0.1f, 5f);
    }
    
    private float Clamp(float value, float min, float max) => Math.Max(min, Math.Min(max, value));
    
    /// <summary>
    /// Reverts the last applied change.
    /// </summary>
    public bool UndoLastChange()
    {
        if (_history.Count > 0)
        {
            _parameters = _history.Pop();
            return true;
        }
        return false;
    }
    
    /// <summary>
    /// Gets a formatted status of current parameters.
    /// </summary>
    public string GetStatus()
    {
        return $"  Enemy Health: {_parameters.EnemyHealthMultiplier:F2}x\n" +
               $"  Enemy Damage: {_parameters.EnemyDamageMultiplier:F2}x\n" +
               $"  Player Damage: {_parameters.PlayerDamageMultiplier:F2}x\n" +
               $"  Shard Gen: {_parameters.ShardGenerationMultiplier:F2}x\n" +
               $"  Item Power: {_parameters.ItemPowerMultiplier:F2}x\n" +
               $"  Changes Applied: {_history.Count}";
    }
    
    /// <summary>
    /// Resets all parameters to defaults.
    /// </summary>
    public void Reset()
    {
        _history.Push(_parameters.Clone());
        _parameters = new BalanceParameters();
    }
}

// ============ Demo / Test ============

public class Program
{
    private static Random _random = new Random();
    
    public static void Main(string[] args)
    {
        Console.WriteLine("BalanceAnalyzer Demo - Simulated Runs\n");
        
        // Create analyzer with auto-apply enabled
        var analyzer = new BalanceAnalyzer(new BalanceAnalyzer.Config
        {
            TargetWinRate = 50f,
            WinRateTolerance = 10f,
            AutoApplySuggestions = true,
            MinSeverityForAutoApply = 0.2f
        });
        
        // Run the full test cycle with simulated runs
        analyzer.RunFullTestCycle(SimulateRun);
        
        Console.WriteLine("\n" + new string('=', 50));
        Console.WriteLine("Demo Complete!");
        Console.WriteLine(new string('=', 50));
        Console.WriteLine("\nThe BalanceAnalyzer:");
        Console.WriteLine("  1. Tracks every run (floor, units, items, shards, damage)");
        Console.WriteLine("  2. Logs summaries after each run");
        Console.WriteLine("  3. Analyzes every 5 runs and suggests balance changes");
        Console.WriteLine("  4. Auto-applies changes to BalanceTuner");
        Console.WriteLine("  5. Continues testing with new values");
    }
    
    /// <summary>
    /// Simulates a game run based on current balance parameters.
    /// Higher enemy multipliers = harder run, etc.
    /// </summary>
    private static BalanceAnalyzer.RunData SimulateRun(BalanceTuner.BalanceParameters balance)
    {
        var run = new BalanceAnalyzer.RunData
        {
            MaxFloors = 10,
            TotalUnits = 4
        };
        
        // Calculate difficulty factor (higher = harder)
        float difficulty = (balance.EnemyHealthMultiplier + balance.EnemyDamageMultiplier) / 2f;
        difficulty /= (balance.PlayerDamageMultiplier * balance.ItemPowerMultiplier);
        difficulty /= balance.ShardGenerationMultiplier * 0.5f + 0.5f;
        
        // Determine success (biased by difficulty)
        float winChance = 0.6f / difficulty; // Base 60% win rate at normal difficulty
        winChance = Math.Max(0.1f, Math.Min(0.9f, winChance));
        
        run.Success = _random.NextDouble() < winChance;
        
        // Floor reached
        if (run.Success)
        {
            run.FloorReached = run.MaxFloors;
        }
        else
        {
            // Failed somewhere between floor 3-9 depending on difficulty
            int minFloor = (int)(3 / difficulty);
            int maxFloor = (int)(9 / difficulty);
            run.FloorReached = _random.Next(Math.Max(1, minFloor), Math.Max(minFloor + 1, maxFloor + 1));
        }
        
        // Units
        run.UnitsDead = run.Success ? _random.Next(0, 2) : _random.Next(2, 5);
        run.UnitsAlive = run.TotalUnits - run.UnitsDead;
        
        // Combat
        run.DamageDealt = (150 + _random.Next(0, 100)) * balance.PlayerDamageMultiplier;
        run.DamageTaken = (200 + _random.Next(0, 150)) * balance.EnemyDamageMultiplier / 
                          (balance.ItemPowerMultiplier * 0.5f + 0.5f);
        run.EnemiesKilled = run.Success ? 15 + _random.Next(0, 10) : 5 + _random.Next(0, 8);
        
        // Shards
        run.ShardsEarned = (int)((30 + _random.Next(0, 40)) * balance.ShardGenerationMultiplier);
        run.ShardsSpent = (int)(run.ShardsEarned * (0.4 + _random.NextDouble() * 0.4));
        run.ShardsRemaining = run.ShardsEarned - run.ShardsSpent;
        
        // Items
        run.ItemsEquipped = _random.Next(1, 5);
        
        // Item power feeling based on multiplier
        if (balance.ItemPowerMultiplier < 0.9f)
            run.ItemPowerRating = "weak";
        else if (balance.ItemPowerMultiplier > 1.3f)
            run.ItemPowerRating = "strong";
        else
            run.ItemPowerRating = _random.NextDouble() < 0.3 ? "weak" : "average";
        
        // Tags
        if (run.Success && run.UnitsDead == 0)
            run.Tags.Add("flawless");
        if (run.DamageTaken > run.DamageDealt * 1.5f)
            run.Tags.Add("rough");
        if (run.ShardsRemaining > run.ShardsEarned * 0.5f)
            run.Tags.Add("hoarder");
        
        return run;
    }
}
