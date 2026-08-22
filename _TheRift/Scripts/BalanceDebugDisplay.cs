using UnityEngine;
using TheRift.Balance;

namespace TheRift.UI
{
    /// <summary>
    /// Debug display for BalanceAnalyzer stats - RENDERING DISABLED.
    /// 
    /// This component no longer renders any UI overlay.
    /// Balance data is logged to console only via BalanceAnalyzer.
    /// 
    /// Keeping this as a stub in case we need the component reference,
    /// but all OnGUI/UI rendering code has been deleted.
    /// </summary>
    public class BalanceDebugDisplay : MonoBehaviour
    {
        [Tooltip("DEPRECATED - No debug overlay is rendered. Data logs to console only.")]
        [SerializeField] private BalanceAnalyzer analyzer;
        
        private void Awake()
        {
            Debug.Log("[BalanceDebugDisplay] Debug overlay rendering DISABLED. BalanceAnalyzer logs to console only.");
            enabled = false;
        }
        
        /// <summary>
        /// Sets the BalanceAnalyzer reference (no-op, kept for API compatibility).
        /// </summary>
        public void SetAnalyzer(BalanceAnalyzer newAnalyzer)
        {
            analyzer = newAnalyzer;
        }
    }
}
