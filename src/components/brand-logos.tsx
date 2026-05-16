// Logos officiels des fournisseurs d'intégration (SVG inline)
// Source : simpleicons.org (licence MIT, redistribuable)
// Chaque logo est rendu en SVG 24x24 avec currentColor pour s'adapter
// à la couleur de marque appliquée par le parent.

type Props = { className?: string };

export function StripeLogo({ className }: Props) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Stripe">
      <path d="M13.479 9.883c-1.626-.604-2.518-1.067-2.518-1.81 0-.625.512-.983 1.422-.983 1.665 0 3.376.642 4.554 1.215l.667-4.105c-.932-.434-2.835-1.15-5.293-1.15-1.711 0-3.143.476-4.169 1.341-1.075.906-1.626 2.225-1.626 3.817 0 2.866 1.671 4.085 4.39 5.046 1.755.633 2.346 1.076 2.346 1.805 0 .708-.598 1.124-1.71 1.124-1.396 0-3.756-.704-5.298-1.585L5.55 17.842c1.345.755 3.825 1.521 6.404 1.521 1.815 0 3.327-.43 4.347-1.234 1.135-.892 1.724-2.196 1.724-3.811 0-2.973-1.794-4.225-4.546-5.435z" />
    </svg>
  );
}

export function DropboxSignLogo({ className }: Props) {
  // Dropbox logo (Dropbox Sign = ex-HelloSign, racheté par Dropbox)
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Dropbox Sign">
      <path d="M6 1.807L0 5.629l6 3.822 6.001-3.822zm12 0l-6 3.822 6 3.822 6-3.822zM0 13.274l6 3.822 6.001-3.822-6.001-3.822zm18-3.822l-6 3.822 6 3.822 6-3.822zM6 18.371l6.001 3.822 6-3.822-6-3.822z" />
    </svg>
  );
}

export function SendGridLogo({ className }: Props) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="SendGrid">
      <path d="M0 16h8.01v7.99H0V16zm8 0h7.99v7.99H8V16zM8.001 8h7.998v7.998H8zm0-8h7.998v7.999H8zm7.99 8H24v8h-8.01zM16 0h8v7.999h-8z" />
    </svg>
  );
}

export function GmailLogo({ className }: Props) {
  // Pour SMTP générique (icône courriel)
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="SMTP">
      <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" />
    </svg>
  );
}

export function GoogleCalendarLogo({ className }: Props) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Google Calendar">
      <path d="M19.5 22h-15A2.5 2.5 0 0 1 2 19.5v-15A2.5 2.5 0 0 1 4.5 2h15A2.5 2.5 0 0 1 22 4.5v15a2.5 2.5 0 0 1-2.5 2.5zm-7.512-8.531c.563.448 1.236.673 2.02.673.566 0 1.082-.118 1.55-.354.469-.236.838-.566 1.108-.991.27-.425.405-.91.405-1.457 0-.503-.13-.952-.39-1.347a2.347 2.347 0 0 0-1.043-.881v-.057a2.46 2.46 0 0 0 1.06-2.084c0-.535-.137-.999-.41-1.39a2.62 2.62 0 0 0-1.078-.892 3.487 3.487 0 0 0-1.477-.31c-.683 0-1.305.183-1.864.547a3.252 3.252 0 0 0-1.244 1.501l1.405.583c.144-.36.36-.643.65-.85.288-.207.617-.31.987-.31.4 0 .74.112 1.018.337.279.225.418.524.418.898 0 .392-.142.711-.426.96-.284.247-.642.371-1.073.371h-.823v1.42h.93c.522 0 .943.13 1.262.39.32.262.479.6.479 1.015 0 .42-.16.766-.479 1.039-.319.273-.732.41-1.24.41a2.05 2.05 0 0 1-1.176-.371 2.16 2.16 0 0 1-.776-.99l-1.439.601c.252.681.671 1.227 1.256 1.638zm-.65-7.43H8.987v.882h1.405v5.96h1.477V5.948c0-.305-.103-.488-.31-.55a1.93 1.93 0 0 0-.55-.082v.722h-.671z" />
    </svg>
  );
}

export function MicrosoftLogo({ className }: Props) {
  // Microsoft 4-colored squares (utiliser fill currentColor uniformement)
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Microsoft">
      <path fill="#F25022" d="M0 0h11.377v11.372H0z" />
      <path fill="#7FBA00" d="M12.623 0H24v11.372H12.623z" />
      <path fill="#00A4EF" d="M0 12.623h11.377V24H0z" />
      <path fill="#FFB900" d="M12.623 12.623H24V24H12.623z" />
    </svg>
  );
}

export function CalendlyLogo({ className }: Props) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Calendly">
      <path d="M19.655 14.262c.281.232.595.521.842.842l3.39-2.59c-.301-.392-.642-.756-1.005-1.083l-3.227 2.831zM12 23.07c-2.755 0-5.343-1.07-7.292-3.014-1.949-1.94-3.022-4.524-3.022-7.27 0-2.748 1.072-5.331 3.022-7.272 1.95-1.94 4.537-3.01 7.292-3.01 2.755 0 5.344 1.07 7.292 3.014 1.95 1.94 3.023 4.524 3.023 7.27v.073l3.685.082v-.155c0-3.732-1.453-7.24-4.094-9.882C19.265 1.455 15.745 0 12 0c-3.745 0-7.265 1.454-9.906 4.097C-.547 6.738 0 10.243 0 14.072c0 3.832.547 7.336 2.094 9.978 2.641 2.643 6.161 4.097 9.906 4.097 3.745 0 7.265-1.454 9.906-4.094 1.452-1.453 2.521-3.156 3.211-5.026l-3.474-1.282c-.494 1.331-1.257 2.546-2.291 3.578-1.949 1.943-4.537 3.013-7.292 3.013z" />
      <path d="M16.07 13.616a4.077 4.077 0 1 1-8.155-.001 4.077 4.077 0 0 1 8.155.001m6.812 0c0 .47-.034.938-.103 1.395l.011-.082-3.487-.262c.03-.343.045-.692.045-1.05 0-.358-.014-.706-.044-1.05l3.487-.263a10.41 10.41 0 0 1 .09 1.312z" />
    </svg>
  );
}

export function SlackLogo({ className }: Props) {
  // Slack multi-color (5 segments)
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Slack">
      <path fill="#E01E5A" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" />
      <path fill="#36C5F0" d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" />
      <path fill="#2EB67D" d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" />
      <path fill="#ECB22E" d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
    </svg>
  );
}

export function ZapierLogo({ className }: Props) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Zapier">
      <path d="M15.229 11.998a7.27 7.27 0 0 1-.45 2.522 7.286 7.286 0 0 1-2.522.456h-.014a7.286 7.286 0 0 1-2.522-.456 7.275 7.275 0 0 1-.45-2.522v-.014c0-.896.16-1.756.45-2.518a7.286 7.286 0 0 1 2.522-.456h.014c.896 0 1.756.16 2.522.456.29.762.45 1.622.45 2.518zm8.301-1.493h-7.04L21.467 5.53a12.252 12.252 0 0 0-1.405-1.659l-.013-.013a12.218 12.218 0 0 0-1.66-1.402l-4.978 4.977V.473A12.083 12.083 0 0 0 12.005 0h-.012c-.685 0-1.357.06-2.013.166v7.04L4.984 2.456A12.087 12.087 0 0 0 3.327 3.86l-.012.013A12.213 12.213 0 0 0 1.913 5.53l4.977 4.975H.473S0 11.306 0 11.993v.013c0 .685.06 1.357.166 2.013h7.04l-4.974 4.977a12.13 12.13 0 0 0 3.07 3.07l4.977-4.977v7.04c.655.105 1.325.166 2.01.166h.022c.683 0 1.354-.06 2.008-.166v-7.04l4.98 4.976a12.214 12.214 0 0 0 1.659-1.403l.013-.012a12.243 12.243 0 0 0 1.403-1.659l-4.977-4.977h7.04c.105-.654.165-1.324.166-2.008v-.022c0-.684-.061-1.354-.166-2.008z" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────
// Mapping provider key → composant logo + couleur de marque
// ─────────────────────────────────────────────────────────
export function BrandLogo({ provider, className }: { provider: string; className?: string }) {
  switch (provider) {
    case "stripe":             return <StripeLogo className={className} />;
    case "dropbox_sign":       return <DropboxSignLogo className={className} />;
    case "sendgrid":           return <SendGridLogo className={className} />;
    case "smtp":               return <GmailLogo className={className} />;
    case "google_calendar":    return <GoogleCalendarLogo className={className} />;
    case "microsoft_calendar": return <MicrosoftLogo className={className} />;
    case "calendly":           return <CalendlyLogo className={className} />;
    case "slack":              return <SlackLogo className={className} />;
    case "zapier":             return <ZapierLogo className={className} />;
    default:                   return null;
  }
}
