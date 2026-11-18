import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { formatCount, t } from '@/lib/i18n';
import { enabledAiProviders } from '@/lib/ai/providers';
import type { AiProvider } from '@/lib/ai/types';
import { createLogger } from '@/lib/logger';
import { getPageInfo } from '@/lib/page';
import type { Truncated } from '@/lib/text';
import { reasonText } from '@/lib/errorMessage';

const log = createLogger('AiScreen');

const REQUIREMENTS_URL = 'https://developer.chrome.com/docs/ai/get-started';

type PageProblem = 'RESTRICTED' | 'NO_ACCESS';

export default function AiScreen() {
  // D11: AI_PROVIDERS decides which providers exist; the first enabled one backs this screen.
  const [provider] = enabledAiProviders();
  if (!provider) {
    return (
      <div className="space-y-4 p-4">
        <Alert>
          <AlertDescription>{t('ai.unavailable')}</AlertDescription>
        </Alert>
      </div>
    );
  }
  return <AiPanel provider={provider} />;
}

function AiPanel({ provider }: { provider: AiProvider }) {
  const availability = useQuery({
    queryKey: ['aiAvailability'],
    queryFn: () => provider.availability(),
  });
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [downloadFailed, setDownloadFailed] = useState(false);
  const [pageProblem, setPageProblem] = useState<PageProblem | null>(null);
  const [truncation, setTruncation] = useState<Truncated | null>(null);
  const [noSelection, setNoSelection] = useState(false);
  const [summarizerDownloadFailed, setSummarizerDownloadFailed] = useState(false);
  const [summarizerDownload, setSummarizerDownload] = useState<string | null>(null);
  const [summarizerUnavailable, setSummarizerUnavailable] = useState(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );

  const resetNotices = () => {
    setError(null);
    setPageProblem(null);
    setTruncation(null);
    setNoSelection(false);
    setSummarizerUnavailable(false);
  };

  const stream = async (source: (signal: AbortSignal) => AsyncIterable<string>) => {
    const ctl = new AbortController();
    controller.current = ctl;
    setStreaming(true);
    setOutput('');
    try {
      let text = '';
      for await (const chunk of source(ctl.signal)) {
        text += chunk;
        setOutput(text);
      }
    } catch (e) {
      if (!ctl.signal.aborted) {
        log.error('ai request failed', { error: e });
        setError(reasonText(e));
      }
    } finally {
      if (controller.current === ctl) controller.current = null;
      setStreaming(false);
    }
  };

  const download = async () => {
    setDownloadFailed(false);
    setError(null);
    setProgress(0);
    try {
      await provider.prepare((fraction) => {
        setProgress(fraction);
      });
      await availability.refetch();
    } catch (e) {
      log.error('ai download failed', { error: e });
      setError(reasonText(e));
      setDownloadFailed(true);
    } finally {
      setProgress(null);
    }
  };

  useEffect(() => {
    if (availability.data === 'downloading') void Promise.resolve().then(download);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availability.data]);

  const runSummary = async (text: string) => {
    await stream((signal) => provider.summarize(text, signal));
  };

  const downloadSummarizer = async (text: string) => {
    setError(null);
    setSummarizerDownloadFailed(false);
    setProgress(0);
    try {
      await provider.prepareSummarizer((fraction) => {
        setProgress(fraction);
      });
      setSummarizerDownload(null);
    } catch (e) {
      log.error('summarizer download failed', { error: e });
      setError(reasonText(e));
      setSummarizerDownloadFailed(true);
      setProgress(null);
      return;
    }
    setProgress(null);
    await runSummary(text);
  };

  const summarize = async () => {
    resetNotices();
    setSummarizerDownload(null);
    setOutput('');
    setBusy(true);
    try {
      const info = await getPageInfo();
      if (!info.ok) {
        setPageProblem(info.code === 'RESTRICTED' ? 'RESTRICTED' : 'NO_ACCESS');
        return;
      }
      if (info.selection.text === '') {
        setNoSelection(true);
        return;
      }
      if (info.selection.truncated) setTruncation(info.selection);
      const state = await provider.summarizerAvailability();
      if (state === 'unavailable') {
        setSummarizerUnavailable(true);
        return;
      }
      if (state === 'downloadable') {
        setSummarizerDownload(info.selection.text);
        return;
      }
      setBusy(false);
      await runSummary(info.selection.text);
    } catch (e) {
      log.error('summarize failed', { error: e });
      setError(reasonText(e));
    } finally {
      setBusy(false);
    }
  };

  const send = () => {
    resetNotices();
    setSummarizerDownload(null);
    void stream((signal) => provider.prompt(input, signal));
  };

  const progressBar = progress !== null && (
    <div className="space-y-1">
      <p className="text-sm">{t('ai.downloading', [Math.round(progress * 100)])}</p>
      <Progress value={Math.round(progress * 100)} />
    </div>
  );

  const requirements = (
    <Alert>
      <AlertDescription className="gap-2">
        <p>{t('ai.unavailable')}</p>
        <a className="underline" href={REQUIREMENTS_URL} target="_blank" rel="noreferrer">
          {t('ai.requirements')}
        </a>
      </AlertDescription>
    </Alert>
  );

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-lg font-semibold">{t(provider.labelKey)}</h1>
      {availability.data === 'unavailable' && requirements}
      {availability.isError && (
        <Alert>
          <AlertDescription className="gap-2">
            <p>{t('ai.failed', [reasonText(availability.error)])}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void availability.refetch();
              }}
            >
              {t('common.retry')}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {(availability.data === 'downloadable' || availability.data === 'downloading') && (
        <div className="space-y-2">
          {progress === null && (
            <Button
              onClick={() => {
                void download();
              }}
            >
              {downloadFailed ? t('common.retry') : t('ai.download')}
            </Button>
          )}
          {progressBar}
        </div>
      )}
      {availability.data === 'available' && (
        <div className="space-y-3">
          <Textarea
            value={input}
            placeholder={t('ai.placeholder')}
            onChange={(e) => {
              setInput(e.target.value);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button disabled={input.trim() === '' || streaming || busy} onClick={send}>
              {t('ai.send')}
            </Button>
            <Button
              variant="outline"
              disabled={streaming || busy || progress !== null}
              onClick={() => {
                void summarize();
              }}
            >
              {t('ai.summarize')}
            </Button>
            {streaming && (
              <Button
                variant="outline"
                onClick={() => {
                  controller.current?.abort();
                }}
              >
                {t('ai.stop')}
              </Button>
            )}
          </div>
          {summarizerDownload !== null && (
            <div className="space-y-2">
              {progress === null && (
                <Button
                  onClick={() => {
                    void downloadSummarizer(summarizerDownload);
                  }}
                >
                  {summarizerDownloadFailed ? t('common.retry') : t('ai.download')}
                </Button>
              )}
              {progressBar}
            </div>
          )}
          {summarizerUnavailable && requirements}
          {pageProblem === 'RESTRICTED' && (
            <Alert>
              <AlertDescription>{t('page.restricted')}</AlertDescription>
            </Alert>
          )}
          {pageProblem === 'NO_ACCESS' && (
            <Alert>
              <AlertDescription className="gap-2">
                <p>{t('page.noAccess')}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void summarize();
                  }}
                >
                  {t('common.retry')}
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {noSelection && <p className="text-sm">{t('page.noSelection')}</p>}
          {truncation && (
            <p className="text-muted-foreground text-sm">
              {t('text.truncated', [formatCount(truncation.shown), formatCount(truncation.total)])}
            </p>
          )}
          {error !== null && (
            <Alert>
              <AlertDescription>{t('ai.failed', [error])}</AlertDescription>
            </Alert>
          )}
          <div aria-live="polite" className="text-sm break-words whitespace-pre-wrap">
            {output}
          </div>
        </div>
      )}
      {error !== null && availability.data !== 'available' && (
        <Alert>
          <AlertDescription>{t('ai.failed', [error])}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
