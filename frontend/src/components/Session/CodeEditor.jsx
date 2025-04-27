import React from "react";
import Editor from "@monaco-editor/react";

const CodeEditor = ({
  editorRef,
  language,
  theme,
  code,
  handleCodeChange,
  handleEditorDidMount,
  fontSize,
}) => {
  return (
    <Editor
      height="100%"
      width="100%"
      language={language}
      theme={theme}
      value={code}
      onChange={handleCodeChange}
      onMount={handleEditorDidMount}
      options={{
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: fontSize,
        wordWrap: "on",
        automaticLayout: true,
      }}
    />
  );
};

export default CodeEditor;
