import React, { useState } from 'react';
import { 
  AlertTriangle, 
  ExternalLink, 
  Copy, 
  Check, 
  X, 
  ShieldAlert, 
  RefreshCw, 
  ArrowRight,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { AuthErrorState } from '../context/AuthContext';

interface AuthErrorModalProps {
  error: AuthErrorState | null;
  onClose: () => void;
  onRetryPopup: () => void;
  onRetryRedirect: () => void;
}

export const AuthErrorModal: React.FC<AuthErrorModalProps> = ({
  error,
  onClose,
  onRetryPopup,
  onRetryRedirect,
}) => {
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [copiedWildcard, setCopiedWildcard] = useState(false);

  if (!error) return null;

  const currentDomain = error.domain || window.location.hostname;
  const isUnauthorizedDomain = error.code === 'auth/unauthorized-domain' || error.message.toLowerCase().includes('unauthorized domain');
  const isPopupBlocked = error.code === 'auth/popup-blocked';
  const isPopupClosed = error.code === 'auth/popup-closed-by-user';

  const firebaseSettingsUrl = `https://console.firebase.google.com/project/${error.projectId}/authentication/settings`;

  const handleCopy = (text: string, type: 'domain' | 'wildcard') => {
    navigator.clipboard.writeText(text);
    if (type === 'domain') {
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2000);
    } else {
      setCopiedWildcard(true);
      setTimeout(() => setCopiedWildcard(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                {isUnauthorizedDomain
                  ? 'Domain-Freigabe in Firebase erforderlich'
                  : isPopupBlocked
                  ? 'Popup vom Browser blockiert'
                  : 'Anmeldung abgebrochen'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isUnauthorizedDomain
                  ? 'Veröffentlichte Cloud Run Adresse muss autorisiert werden'
                  : 'Fehlercode: ' + error.code}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Diagnostic explanation */}
        {isUnauthorizedDomain ? (
          <div className="space-y-4 text-xs text-slate-300">
            <p className="leading-relaxed bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 text-slate-300">
              Google Firebase verlangt aus Sicherheitsgründen, dass jede Webadresse, von der aus sich Nutzer anmelden dürfen, in den <span className="text-amber-400 font-semibold">„Autorisierten Domains“</span> der Firebase-Konsole registriert ist. Da deine App veröffentlicht wurde, unterscheidet sich die neue Domain von der internen Vorschau.
            </p>

            {/* Current domain badge with copy */}
            <div className="space-y-2">
              <span className="text-slate-400 font-medium block">
                1. Kopiere diese Domain:
              </span>
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs">
                <span className="text-emerald-400 truncate select-all">{currentDomain}</span>
                <button
                  onClick={() => handleCopy(currentDomain, 'domain')}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition text-[11px] shrink-0"
                >
                  {copiedDomain ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedDomain ? 'Kopiert!' : 'Kopieren'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-950/60 border border-slate-800/60 font-mono text-[11px] text-slate-400">
                <span>Oder alternativ Wildcard: <strong className="text-amber-300">run.app</strong> (deckt alle Instanzen ab)</span>
                <button
                  onClick={() => handleCopy('run.app', 'wildcard')}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 transition text-[10px] shrink-0"
                >
                  {copiedWildcard ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>Kopieren</span>
                </button>
              </div>
            </div>

            {/* Step-by-Step guide */}
            <div className="space-y-2 bg-slate-950/50 p-3.5 rounded-xl border border-slate-800/80">
              <span className="font-bold text-slate-200 block text-xs flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-cyan-400" />
                2. Freischaltung in 30 Sekunden:
              </span>
              <ol className="space-y-1.5 pl-4 list-decimal text-slate-400 text-[11px]">
                <li>Öffne die Firebase-Konsole über den untenstehenden Button.</li>
                <li>Scrolle zum Bereich <span className="text-slate-200 font-medium">„Autorisierte Domains“</span> (Authorized domains).</li>
                <li>Klicke auf <span className="text-slate-200 font-medium">„Domain hinzufügen“</span>, füge <code className="text-amber-300 bg-slate-900 px-1 rounded">{currentDomain}</code> oder <code className="text-amber-300 bg-slate-900 px-1 rounded">run.app</code> ein und klicke auf Speichern.</li>
                <li>Kehre hierher zurück und klicke auf <span className="text-emerald-400 font-medium">„Erneut anmelden“</span>.</li>
              </ol>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <a
                href={firebaseSettingsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer"
              >
                <span>Firebase-Konsole öffnen (Projekt: {error.projectId})</span>
                <ExternalLink className="w-4 h-4" />
              </a>

              <div className="flex gap-2">
                <button
                  onClick={onRetryPopup}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Erneut mit Popup versuchen</span>
                </button>

                <button
                  onClick={onRetryRedirect}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                >
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Mit Weiterleitung (Redirect)</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Other popup errors (blocked or closed) */
          <div className="space-y-4 text-xs text-slate-300">
            <p className="leading-relaxed bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 text-slate-300">
              {isPopupBlocked
                ? 'Dein Webbrowser hat das Anmeldefenster blockiert. Bitte erlaube Popups für diese Website oder nutze die direkte Weiterleitung.'
                : 'Das Anmeldefenster wurde geschlossen oder Drittanbieter-Cookies sind in deinem Browser blockiert.'}
            </p>

            <div className="space-y-2 pt-2">
              <button
                onClick={onRetryRedirect}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition cursor-pointer"
              >
                <span>Mit direkter Weiterleitung anmelden (Empfohlen bei Popup-Sperren)</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={onRetryPopup}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Popup erneut öffnen</span>
              </button>
            </div>
          </div>
        )}

        <div className="text-center pt-1 border-t border-slate-800/60">
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-200 transition"
          >
            Schließen & im lokalen Modus fortfahren
          </button>
        </div>
      </div>
    </div>
  );
};
