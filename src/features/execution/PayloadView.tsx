import { useMemo } from 'react';
import type { JsonObject } from '../../contracts/workflow';
import { canonicalJson } from '../../domain/json/canonical';
import { boundedPreview } from '../../ui/bounded-preview';
import { useAppStore } from '../../state/context';
import { errorMessage } from '../../ui/messages';
import { Button } from '../../ui/primitives';
import { downloadText } from '../workflows/download';
export function PayloadView({
  value,
  title,
}: {
  readonly value: JsonObject | undefined;
  readonly title: string;
}) {
  const announce = useAppStore((s) => s.announce);
  const preview = useMemo(() => (value ? boundedPreview(canonicalJson(value)) : null), [value]);
  return (
    <div className="payload-view">
      <h4>{title}</h4>
      {preview ? (
        <>
          <pre aria-label={title}>{preview.text}</pre>
          {preview.truncated && (
            <p>Preview truncated at 64 KiB. Download contains the full payload.</p>
          )}
          <Button
            onClick={() => {
              if (value) {
                const result = downloadText(canonicalJson(value), 'execution-result');
                if (!result.ok) announce(errorMessage(result.error));
              }
            }}
          >
            Download {title}
          </Button>
        </>
      ) : (
        <p>No payload for this disposition.</p>
      )}
    </div>
  );
}
