'use client';

interface CopyButtonProps {
  text: string;
}

export function CopyButton({ text }: CopyButtonProps) {
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text)}
      style={{ marginLeft: '0.5rem', cursor: 'pointer', background: 'none', border: 'none' }}
      title="Copy full URL"
    >
      Copy
    </button>
  );
}
