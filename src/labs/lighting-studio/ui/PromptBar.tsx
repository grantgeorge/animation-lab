"use client";

import { studioStore } from "../store";
import { useEffective } from "./hooks";

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export async function copyPrompt(text: string) {
  const ok = await copyText(text);
  studioStore.getState().toast(ok ? "Lighting prompt copied" : "Couldn't copy: select the text instead", "C");
}

/** The lighting described as an AI-video prompt phrase, rebuilt from the rig on every change. */
export function PromptBar() {
  const { prompt } = useEffective();
  return (
    <div className="ls-prompt" data-testid="prompt-bar">
      <span className="ls-prompt-label">
        Lighting
        <br />
        prompt
      </span>
      <p className="ls-prompt-text" data-testid="prompt-text">
        {prompt}
      </p>
      <button
        type="button"
        className="ls-copy"
        onClick={() => void copyPrompt(prompt)}
        data-testid="copy-prompt"
        title="Copy the lighting phrase (C)"
      >
        Copy
      </button>
    </div>
  );
}
