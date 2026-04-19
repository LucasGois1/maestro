import * as react_jsx_runtime from 'react/jsx-runtime';

declare function HelloWorld(props: {
    version: string;
}): react_jsx_runtime.JSX.Element;

declare function formatHelloMessage(version: string): string;

declare const TUI_PACKAGE_NAME = "@maestro/tui";

export { HelloWorld, TUI_PACKAGE_NAME, formatHelloMessage };
