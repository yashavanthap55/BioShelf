/** Time-ordered, collision-resistant identifier for new records. */
export function generateId(): string {
  const time = Date.now().toString(36);
  const noise = Math.floor(Math.random() * 0x7fffffff)
    .toString(36)
    .padStart(6, '0');
  return `${time}-${noise}`;
}
