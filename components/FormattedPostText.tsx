import React from "react";
import { Platform, Text, TextStyle } from "react-native";

type InlineRun = { text: string; style?: TextStyle };

function parseInlineRuns(
  text: string,
  styles: {
    bold: TextStyle;
    italic: TextStyle;
    underline: TextStyle;
    code: TextStyle;
  },
): InlineRun[] {
  const markers = [
    { token: "**", style: styles.bold },
    { token: "__", style: styles.underline },
    { token: "_", style: styles.italic },
    { token: "`", style: styles.code },
  ];

  const runs: InlineRun[] = [];
  let buffer = "";
  let i = 0;

  const flushBuffer = () => {
    if (buffer.length > 0) {
      runs.push({ text: buffer });
      buffer = "";
    }
  };

  while (i < text.length) {
    let matched = false;
    for (const marker of markers) {
      if (text.startsWith(marker.token, i)) {
        const end = text.indexOf(marker.token, i + marker.token.length);
        if (end !== -1) {
          const content = text.slice(i + marker.token.length, end);
          flushBuffer();
          if (content.length > 0) {
            runs.push({ text: content, style: marker.style });
          }
          i = end + marker.token.length;
          matched = true;
          break;
        }
      }
    }
    if (!matched) {
      buffer += text[i];
      i += 1;
    }
  }

  flushBuffer();
  return runs;
}

export default function FormattedPostText({
  text,
  color,
  mutedColor,
  codeBackground,
  numberOfLines,
  lineHeight = 22,
}: {
  text: string;
  color: string;
  mutedColor: string;
  codeBackground: string;
  numberOfLines?: number;
  lineHeight?: number;
}) {
  const lines = text.split(/\r?\n/);
  const styles = {
    bold: { fontWeight: "700" as const },
    italic: { fontStyle: "italic" as const },
    underline: { textDecorationLine: "underline" as const },
    code: {
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      backgroundColor: codeBackground,
      borderRadius: 4,
      paddingHorizontal: 4,
      paddingVertical: 1,
    } as const,
  };

  return (
    <Text style={{ color, lineHeight }} numberOfLines={numberOfLines}>
      {lines.map((line, lineIndex) => {
        let prefix = "";
        let content = line;

        if (line.startsWith("- ")) {
          prefix = "- ";
          content = line.slice(2);
        } else if (line.startsWith("> ")) {
          prefix = "> ";
          content = line.slice(2);
        }

        const runs = parseInlineRuns(content, styles);

        return (
          <Text key={`line-${lineIndex}`}>
            {prefix.length > 0 && (
              <Text style={{ color: mutedColor, fontWeight: "600" }}>
                {prefix}
              </Text>
            )}
            {runs.map((run, idx) => (
              <Text key={`run-${lineIndex}-${idx}`} style={run.style}>
                {run.text}
              </Text>
            ))}
            {lineIndex < lines.length - 1 ? "\n" : null}
          </Text>
        );
      })}
    </Text>
  );
}
