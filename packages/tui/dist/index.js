// src/components/HelloWorld.tsx
import { Box, Text } from "ink";

// src/message.ts
function formatHelloMessage(version) {
  return `Hello from Maestro \xB7 v${version}`;
}

// src/components/HelloWorld.tsx
import { jsx } from "react/jsx-runtime";
function HelloWorld(props) {
  const { version } = props;
  return /* @__PURE__ */ jsx(
    Box,
    {
      borderColor: "green",
      borderStyle: "round",
      flexDirection: "column",
      paddingX: 2,
      paddingY: 1,
      children: /* @__PURE__ */ jsx(Text, { color: "green", children: formatHelloMessage(version) })
    }
  );
}

// src/index.ts
var TUI_PACKAGE_NAME = "@maestro/tui";
export {
  HelloWorld,
  TUI_PACKAGE_NAME,
  formatHelloMessage
};
//# sourceMappingURL=index.js.map