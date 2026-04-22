declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const originalError = console.error.bind(console);

console.error = (...args: unknown[]) => {
  const message = String(args[0] ?? '');
  if (
    message.includes('not wrapped in act(...)') ||
    message.includes('not configured to support act(...)')
  ) {
    return;
  }
  originalError(...args);
};

export {};
