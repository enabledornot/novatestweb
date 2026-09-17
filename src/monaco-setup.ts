// Import only the core editor API + the language contributions this
// project actually uses, not the top-level "monaco-editor" entry — that
// pulls in all ~90 bundled languages plus the JSON/CSS/HTML/TypeScript
// language-service workers (multiple MB each), none of which are needed
// here. Add a contribution import here whenever a new LanguageRunner is
// registered (src/languages/registry.ts).
import * as monaco from "monaco-editor/editor/editor.api";
import "monaco-editor/languages/definitions/cpp/register.js"; // also registers "c"
import "monaco-editor/languages/definitions/python/register.js";
import { loader } from "@monaco-editor/react";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";

// @monaco-editor/react defaults to fetching Monaco's JS/CSS from a CDN at
// runtime. This app avoids all external requests and pins exact runtime
// versions instead of ever loading "latest" from elsewhere — point it at
// the copy already bundled into this build instead.
self.MonacoEnvironment = {
  getWorker() {
    return new EditorWorker();
  },
};

loader.config({ monaco });
