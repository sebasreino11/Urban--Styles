"use client";

import { useState, useTransition } from "react";
import { saveHookUrl, sendTestPush } from "@/app/(staff)/actions";
import { buttonClass, Field, inputClass } from "./ui";

export function HookUrlForm({ initialUrl }: { initialUrl: string }) {
  const [hookUrl, setHookUrl] = useState(initialUrl);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: typeof saveHookUrl, okText: string) =>
    start(async () => {
      const r = await fn({ hookUrl });
      setMessage(r.ok ? { ok: true, text: okText } : { ok: false, text: r.message });
    });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(saveHookUrl, hookUrl ? "Guardado. Las próximas citas te llegarán al celular." : "Avisos desactivados.");
      }}
      className="grid gap-4 self-start rounded-lg border border-border bg-card p-5"
    >
      <Field label="Tu URL de Hook.Notifier" hint="Es privada: solo tú y el administrador pueden verla.">
        <input
          className={inputClass}
          value={hookUrl}
          onChange={(e) => setHookUrl(e.target.value)}
          placeholder="https://hooknotifier.com/…"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <button className={buttonClass.primary} disabled={pending}>Guardar</button>
        <button
          type="button"
          className={buttonClass.secondary}
          disabled={pending || !hookUrl}
          onClick={() => run(sendTestPush, "Prueba enviada. Revisa tu celular.")}
        >
          Enviar prueba
        </button>
      </div>
      {message && (
        <p role="status" className={message.ok ? "text-sm text-success" : "text-sm text-destructive"}>
          {message.text}
        </p>
      )}
    </form>
  );
}
