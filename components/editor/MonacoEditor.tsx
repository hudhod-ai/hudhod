"use client";

import dynamic from "next/dynamic";

const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-xs text-zinc-400">
      Loading editor…
    </div>
  ),
});

function languageForPath(path: string): string {
  const ext = path.split(".").pop() ?? "";
  switch (ext) {
    case "ts":
      return "typescript";
    case "tsx":
      return "typescript";
    case "js":
      return "javascript";
    case "jsx":
      return "javascript";
    case "json":
      return "json";
    case "css":
      return "css";
    case "html":
      return "html";
    case "md":
      return "markdown";
    default:
      return "plaintext";
  }
}

interface MonacoEditorProps {
  path: string;
  value: string;
  theme: "light" | "dark";
  onChange: (value: string) => void;
}

export function MonacoEditor({ path, value, theme, onChange }: MonacoEditorProps) {
  return (
    <Editor
      key={path}
      path={path}
      language={languageForPath(path)}
      value={value}
      theme={theme === "dark" ? "vs-dark" : "vs"}
      onChange={(next) => onChange(next ?? "")}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        automaticLayout: true,
        scrollBeyondLastLine: false,
      }}
    />
  );
}
