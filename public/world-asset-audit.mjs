export function summarizeWorldAssetStates(states = []) {
  const list = Array.isArray(states) ? states : [];
  const authored = list.filter(state => state === "authored").length;
  const loading = list.filter(state => state === "fallback-loading").length;
  const fallback = list.length - authored - loading;
  return Object.freeze({
    total: list.length,
    authored,
    loading,
    fallback,
    complete: list.length > 0,
  });
}
