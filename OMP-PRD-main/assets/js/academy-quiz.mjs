/** Shuffle display order only. Values sent to the server remain original indexes. */
export function shuffledOptions(options, random = Math.random) {
  const result = options.map((label, index) => ({ label, index }));
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
