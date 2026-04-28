import { clipboard } from 'electron';

import type {
  AppSettings,
  AppStatus,
  FocusInfo,
  ImageGenerationResult,
  ProcessAudioResult,
} from '../shared/types';
import { getEnhancementPrompt } from './prompts';
import { rewriteWithOllama } from './ollama';
import { rewriteWithOpenRouter } from './openrouter';
import { getFocusInfo, triggerPaste } from './native-helper';
import { detectImageTrigger, runImageAgent } from './image-agent';
import { ensureStorage } from './storage';

interface ProcessDictationOptions {
  wavBase64: string;
  settings: AppSettings;
  targetFocus?: FocusInfo;
  setStatus: (status: AppStatus) => void;
}

function createIdleStatus(): AppStatus {
  return {
    phase: 'idle',
    title: 'Ready',
    detail: 'Hold Fn to dictate. Release Fn to paste.',
  };
}

export async function processDictationAudio({
  wavBase64,
  settings,
  targetFocus,
  setStatus,
}: ProcessDictationOptions): Promise<ProcessAudioResult> {
  const storage = await ensureStorage(settings);

  setStatus({
    phase: 'transcribing',
    title: 'Transcribing',
    detail: `${settings.whisperLabel} is turning your voice into text.`,
  });

  const { transcribeRecording } = await import('./transcription');
  const rawText = await transcribeRecording(wavBase64, settings, storage);
  if (!rawText) {
    setStatus({
      phase: 'error',
      title: 'Nothing heard',
      detail: 'OpenWhisp did not detect enough speech to transcribe.',
    });
    throw new Error('No speech was detected in the recording.');
  }

  const useOpenRouter = settings.textProvider === 'openrouter';
  const activeRewriteModel = useOpenRouter ? settings.openrouterTextModel : settings.textModel;

  setStatus({
    phase: 'rewriting',
    title: 'Polishing',
    detail: useOpenRouter
      ? `${activeRewriteModel} is polishing your dictation via OpenRouter.`
      : `${activeRewriteModel} is applying the selected rewrite level. The first request can take a moment while Ollama warms the model.`,
    preview: rawText,
    rawText,
  });

  let finalText = rawText;
  let usedRewriteFallback = false;

  try {
    finalText = useOpenRouter
      ? await rewriteWithOpenRouter(
          settings.openrouterApiKey,
          settings.openrouterTextModel,
          getEnhancementPrompt(settings.styleMode, settings.enhancementLevel),
          rawText,
        )
      : await rewriteWithOllama(
          settings.ollamaBaseUrl,
          settings.textModel,
          getEnhancementPrompt(settings.styleMode, settings.enhancementLevel),
          rawText,
        );
  } catch (error) {
    usedRewriteFallback = true;
    setStatus({
      phase: 'error',
      title: 'Rewrite unavailable',
      detail:
        error instanceof Error
          ? `${error.message} OpenWhisp will use the raw transcription for now.`
          : 'OpenWhisp could not finish the rewrite pass, so it will use the raw transcription.',
      preview: rawText,
      rawText,
    });
  }

  let image: ImageGenerationResult | undefined;
  let imageError: string | undefined;
  let imageNote: string | undefined;

  const triggerHeard = detectImageTrigger(rawText) || detectImageTrigger(finalText);
  if (triggerHeard && !settings.imageAgent.enabled) {
    imageNote = 'Image AI is OFF in Models › Image AI. Toggle it on to generate.';
    console.log('[dictation] image trigger heard but image agent disabled');
  } else if (triggerHeard && !settings.openrouterApiKey) {
    imageNote = 'Add an OpenRouter API key in Models to enable image generation.';
    console.log('[dictation] image trigger heard but no OpenRouter API key');
  }

  if (settings.imageAgent.enabled && settings.openrouterApiKey) {
    try {
      const agentResult = await runImageAgent({
        settings,
        rawText,
        rewrittenText: finalText,
        setStatus,
      });
      finalText = agentResult.finalText;
      image = agentResult.image;
      if (!image && agentResult.decisionReason) {
        imageNote = agentResult.decisionReason;
      }
    } catch (error) {
      imageError =
        error instanceof Error ? error.message : 'Image generation failed.';
      console.error('[dictation] image agent threw:', imageError);
      setStatus({
        phase: 'error',
        title: 'Image generation failed',
        detail: `${imageError} OpenWhisp will paste the dictation only.`,
        preview: finalText,
        rawText,
      });
    }
  }

  clipboard.writeText(finalText);

  let pasted = false;
  let focusInfo = targetFocus;

  if (settings.autoPaste) {
    setStatus({
      phase: 'pasting',
      title: 'Pasting',
      detail: 'Sending the polished text to the active app.',
      preview: finalText,
      rawText,
    });

    focusInfo = targetFocus ?? (await getFocusInfo().catch(() => undefined));
    pasted = await triggerPaste(focusInfo).catch(() => false);
  }

  const doneTitle = image ? (pasted ? 'Image pasted' : 'Image copied') : pasted ? 'Pasted' : 'Copied';
  const doneDetail = image
    ? pasted
      ? `Pasted "${image.prompt.slice(0, 60)}" via ${image.model}.`
      : 'Image URL is on the clipboard. Paste it where you need it.'
    : usedRewriteFallback
      ? pasted
        ? 'The raw transcription was pasted because the rewrite model was unavailable.'
        : 'The raw transcription is on the clipboard because the rewrite model was unavailable.'
      : pasted
        ? 'The refined text was pasted into the active app.'
        : focusInfo?.appName
          ? `OpenWhisp copied the text, but it could not paste into ${focusInfo.appName}.`
          : 'The refined text is on the clipboard.';

  const detailWithNotes = imageError
    ? `${doneDetail} (${imageError})`
    : imageNote
      ? `${doneDetail} (image agent: ${imageNote})`
      : doneDetail;

  setStatus({
    phase: 'done',
    title: doneTitle,
    detail: detailWithNotes,
    preview: finalText,
    rawText,
    imageUrl: image?.url,
  });

  setTimeout(() => {
    setStatus(createIdleStatus());
  }, 1_500);

  return {
    rawText,
    finalText,
    pasted,
    focusInfo,
    image,
  };
}

export function getInitialStatus(): AppStatus {
  return createIdleStatus();
}
