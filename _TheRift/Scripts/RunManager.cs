using System.Collections.Generic;
using TheRift.Balance;
using UnityEngine;

namespace TheRift.Core
{
    /// <summary>
    /// Manages game runs and integrates with BalanceAnalyzer.
    /// Attach to a persistent GameObject in the scene.
    /// </summary>
    public class RunManager : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private BalanceAnalyzer balanceAnalyzer;
        
        [Header("Run Settings")]
        [SerializeField] private int maxFloors = 10;
        
        [Header("Debug")]
        [SerializeField] private bool showDebugLogs = true;
        
        // Current run tracking
        private bool isRunActive = false;
        private int currentFloor = 0;
        private float runStartTime;
        private float damageTaken = 0f;
        private float damageDealt = 0f;
        private int enemiesKilled = 0;
        private int shardsEarned = 0;
        private int shardsSpent = 0;
        private int itemsEquipped = 0;
        private string itemPowerRating = "average";
        private List<string> runTags = new List<string>();
        
        // Unit tracking (simplified - integrate with your actual unit system)
        private List<UnitData> currentSquad = new List<UnitData>();
        
        // Properties
        public bool IsRunActive => isRunActive;
        public int CurrentFloor => currentFloor;
        public BalanceAnalyzer BalanceAnalyzer => balanceAnalyzer;
        
        public static RunManager Instance { get; private set; }
        
        [System.Serializable]
        public class UnitData
        {
            public string UnitId;
            public bool IsAlive = true;
            public float Health;
            public float MaxHealth;
        }
        
        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
            }
            else
            {
                Destroy(gameObject);
                return;
            }
            
            // Auto-find or create BalanceAnalyzer
            SetupBalanceAnalyzer();
        }
        
        private void SetupBalanceAnalyzer()
        {
            if (balanceAnalyzer == null)
            {
                balanceAnalyzer = FindFirstObjectByType<BalanceAnalyzer>();
                
                if (balanceAnalyzer == null)
                {
                    Debug.Log("[RunManager] Creating BalanceAnalyzer...");
                    GameObject analyzerObj = new GameObject("BalanceAnalyzer");
                    balanceAnalyzer = analyzerObj.AddComponent<BalanceAnalyzer>();
                    DontDestroyOnLoad(analyzerObj);
                }
            }
            
            // Subscribe to events
            balanceAnalyzer.OnRunLogged += OnRunLogged;
            balanceAnalyzer.OnAnalysisComplete += OnAnalysisComplete;
            balanceAnalyzer.OnSuggestionApplied += OnSuggestionApplied;
        }
        
        // ============ Run Lifecycle ============
        
        /// <summary>
        /// Starts a new run. Call this when the player begins a dungeon run.
        /// </summary>
        public void StartRun(List<UnitData> squad)
        {
            if (isRunActive)
            {
                Debug.LogWarning("[RunManager] Tried to start run while another is active!");
                return;
            }
            
            isRunActive = true;
            currentFloor = 1;
            runStartTime = Time.time;
            currentSquad = new List<UnitData>(squad);
            
            // Reset tracking
            damageTaken = 0f;
            damageDealt = 0f;
            enemiesKilled = 0;
            shardsEarned = 0;
            shardsSpent = 0;
            itemsEquipped = 0;
            itemPowerRating = "average";
            runTags.Clear();
            
            if (showDebugLogs)
            {
                Debug.Log($"[RunManager] Run started! Squad size: {squad.Count}");
                Debug.Log($"[RunManager] Current Balance: Enemy Health {balanceAnalyzer.Tuner.Parameters.EnemyHealthMultiplier:F2}x, Damage {balanceAnalyzer.Tuner.Parameters.EnemyDamageMultiplier:F2}x");
            }
        }
        
        /// <summary>
        /// Advances to the next floor. Call this when player clears a floor.
        /// </summary>
        public void AdvanceFloor()
        {
            if (!isRunActive)
            {
                Debug.LogWarning("[RunManager] Tried to advance floor but no run is active!");
                return;
            }
            
            currentFloor++;
            
            if (showDebugLogs)
            {
                Debug.Log($"[RunManager] Advanced to floor {currentFloor}/{maxFloors}");
            }
            
            // Check if reached final floor
            if (currentFloor > maxFloors)
            {
                CompleteRun(true);
            }
        }
        
        /// <summary>
        /// Completes the current run. Call this when run ends (success or failure).
        /// </summary>
        public void CompleteRun(bool success)
        {
            if (!isRunActive)
            {
                Debug.LogWarning("[RunManager] Tried to complete run but no run is active!");
                return;
            }
            
            isRunActive = false;
            float runDuration = Time.time - runStartTime;
            
            // Count survivors
            int aliveCount = 0;
            int deadCount = 0;
            foreach (var unit in currentSquad)
            {
                if (unit.IsAlive) aliveCount++;
                else deadCount++;
            }
            
            // Determine item power rating
            if (damageDealt > damageTaken * 2f)
            {
                itemPowerRating = "strong";
            }
            else if (damageDealt < damageTaken * 0.8f)
            {
                itemPowerRating = "weak";
            }
            else
            {
                itemPowerRating = "average";
            }
            
            // Log the run to BalanceAnalyzer
            balanceAnalyzer.LogRun(
                floorReached: currentFloor,
                maxFloors: maxFloors,
                success: success,
                unitsAlive: aliveCount,
                unitsDead: deadCount,
                totalUnits: currentSquad.Count,
                damageTaken: damageTaken,
                damageDealt: damageDealt,
                enemiesKilled: enemiesKilled,
                itemsEquipped: itemsEquipped,
                itemPowerRating: itemPowerRating,
                shardsEarned: shardsEarned,
                shardsSpent: shardsSpent,
                runDurationSeconds: runDuration,
                tags: new List<string>(runTags)
            );
            
            if (showDebugLogs)
            {
                Debug.Log($"[RunManager] Run completed! Success: {success}, Floor: {currentFloor}/{maxFloors}");
            }
        }
        
        /// <summary>
        /// Fails the current run. Convenience method.
        /// </summary>
        public void FailRun()
        {
            CompleteRun(false);
        }
        
        // ============ Event Tracking ============
        
        /// <summary>
        /// Records damage taken by the player's squad.
        /// </summary>
        public void RecordDamageTaken(float amount)
        {
            damageTaken += amount;
        }
        
        /// <summary>
        /// Records damage dealt by the player's squad.
        /// </summary>
        public void RecordDamageDealt(float amount)
        {
            damageDealt += amount;
        }
        
        /// <summary>
        /// Records an enemy kill.
        /// </summary>
        public void RecordEnemyKilled()
        {
            enemiesKilled++;
        }
        
        /// <summary>
        /// Records shards earned.
        /// </summary>
        public void RecordShardsEarned(int amount)
        {
            shardsEarned += amount;
        }
        
        /// <summary>
        /// Records shards spent.
        /// </summary>
        public void RecordShardsSpent(int amount)
        {
            shardsSpent += amount;
        }
        
        /// <summary>
        /// Records an item being equipped.
        /// </summary>
        public void RecordItemEquipped()
        {
            itemsEquipped++;
        }
        
        /// <summary>
        /// Records a unit death.
        /// </summary>
        public void RecordUnitDeath(string unitId)
        {
            foreach (var unit in currentSquad)
            {
                if (unit.UnitId == unitId)
                {
                    unit.IsAlive = false;
                    break;
                }
            }
        }
        
        /// <summary>
        /// Adds a tag to the current run.
        /// </summary>
        public void AddTag(string tag)
        {
            if (!runTags.Contains(tag))
            {
                runTags.Add(tag);
            }
        }
        
        // ============ Event Handlers ============
        
        private void OnRunLogged(BalanceAnalyzer.RunData run)
        {
            if (showDebugLogs)
            {
                Debug.Log($"[RunManager] Run #{run.RunNumber} logged to BalanceAnalyzer");
            }
            
            // Check if we should display suggestions
            if (run.RunNumber % balanceAnalyzer.Configuration.RunsPerAnalysis == 0)
            {
                DisplayCurrentSuggestion();
            }
        }
        
        private void OnAnalysisComplete(BalanceAnalyzer.AnalysisResult analysis)
        {
            if (showDebugLogs)
            {
                Debug.Log($"[RunManager] Balance analysis complete. Win Rate: {analysis.WinRate:F1}%");
            }
        }
        
        private void OnSuggestionApplied(BalanceAnalyzer.BalanceSuggestion suggestion)
        {
            Debug.Log($"[RunManager] Balance suggestion applied: {suggestion}");
            
            // Here you could broadcast to other systems that balance has changed
            // e.g., EnemySpawner.UpdateDifficulty(balanceAnalyzer.Tuner.Parameters);
        }
        
        // ============ Debug Display ============
        
        /// <summary>
        /// Gets the current suggestion text for display.
        /// </summary>
        public string GetCurrentSuggestionText()
        {
            var suggestion = balanceAnalyzer?.GetCurrentSuggestion();
            if (suggestion != null)
            {
                return $"{suggestion.Category}: {suggestion.SuggestedChange}";
            }
            return "No pending suggestions";
        }
        
        /// <summary>
        /// Displays current suggestion in console.
        /// </summary>
        public void DisplayCurrentSuggestion()
        {
            var suggestion = balanceAnalyzer?.GetCurrentSuggestion();
            if (suggestion != null)
            {
                Debug.Log($"[BalanceAnalyzer] Current Suggestion: [{suggestion.Category}] {suggestion.SuggestedChange}");
            }
        }
        
        /// <summary>
        /// Gets debug info for UI display.
        /// </summary>
        public string GetDebugInfo()
        {
            if (balanceAnalyzer == null) return "BalanceAnalyzer not initialized";
            
            string suggestion = GetCurrentSuggestionText();
            if (suggestion.Length > 50)
            {
                suggestion = suggestion.Substring(0, 47) + "...";
            }
            
            return $"Runs: {balanceAnalyzer.TotalRuns}\n" +
                   $"Win Rate: {balanceAnalyzer.CurrentWinRate:F1}%\n" +
                   $"Suggestion: {suggestion}";
        }
        
        // ============ Helper Methods ============
        
        /// <summary>
        /// Manually triggers analysis. Useful for testing.
        /// </summary>
        public void ForceAnalysis()
        {
            if (balanceAnalyzer != null)
            {
                balanceAnalyzer.AnalyzeLastRuns(balanceAnalyzer.Configuration.RunsPerAnalysis);
            }
        }
        
        /// <summary>
        /// Gets the current run stats for display.
        /// </summary>
        public string GetCurrentRunStats()
        {
            if (!isRunActive) return "No active run";
            
            return $"Floor: {currentFloor}/{maxFloors}\n" +
                   $"Damage: {damageDealt:F0} dealt / {damageTaken:F0} taken\n" +
                   $"Enemies: {enemiesKilled} killed\n" +
                   $"Shards: {shardsEarned} earned / {shardsSpent} spent\n" +
                   $"Items: {itemsEquipped} equipped";
        }
        
        private void OnDestroy()
        {
            if (balanceAnalyzer != null)
            {
                balanceAnalyzer.OnRunLogged -= OnRunLogged;
                balanceAnalyzer.OnAnalysisComplete -= OnAnalysisComplete;
                balanceAnalyzer.OnSuggestionApplied -= OnSuggestionApplied;
            }
            
            if (Instance == this)
            {
                Instance = null;
            }
        }
    }
}
