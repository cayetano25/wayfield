interface RichTextDisplayProps {
  html: string;
  className?: string;
}

export function RichTextDisplay({ html, className }: RichTextDisplayProps) {
  if (!html) return null;
  return (
    <div
      className={`prose-wayfield ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
