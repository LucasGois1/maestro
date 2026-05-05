/**
 * Clears the visible terminal and moves the cursor home. Use between successive
 * Ink roots so the next full-screen TUI does not stack under the previous one.
 */
export function clearTerminalViewport(): void {
  if (!process.stdout.isTTY) {
    return;
  }
  // Clear entire screen and move cursor to home
  process.stdout.write('\u001b[2J\u001b[H');
  // Clear scrollback buffer as well to prevent ghosting
  process.stdout.write('\u001b[3J');
}
