// Visualizing the bug
let isGraphReplayRunning = true;
// interval is cleared because visitedNodeIds changed, triggering cleanup.
// useEffect runs again.
if (isGraphReplayRunning) return; // Returns early, interval is never restarted!
