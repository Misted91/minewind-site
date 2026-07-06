// Firebase (compat SDK, classic <script> — keeps the no-build architecture).
// The apiKey is NOT a secret for web apps; access is controlled by Firestore rules.
// Loaded after the firebase-*-compat.js CDN scripts. Exposes window.__FB__.
(function(){
  var config = {
    apiKey: "AIzaSyD1N4YmMmEBFcW1KxP6Fy43ZPsMsrxHg-8",
    authDomain: "minewind-trade.firebaseapp.com",
    projectId: "minewind-trade",
    storageBucket: "minewind-trade.firebasestorage.app",
    messagingSenderId: "192246732305",
    appId: "1:192246732305:web:a32ae059bb411f9df183b0"
  };

  // App Check (anti-abuse): stops anonymous scripts from spamming Firestore from
  // outside the real site. Paste the reCAPTCHA v3 *site key* from
  // Firebase console → App Check → register this web app (reCAPTCHA v3).
  // Left empty = App Check disabled (site still works); fill it to enforce.
  var RECAPTCHA_SITE_KEY = "6Le9QEctAAAAAOfiAEYf0mEabmhUilZbMgDBcTGU";

  if (typeof firebase === 'undefined' || !firebase.initializeApp){
    window.__FB__ = null; // CDN blocked / offline — trade tab shows a fallback message
    return;
  }
  firebase.initializeApp(config);

  // App Check protects the DEPLOYED public site. It is activated only when a
  // site key is set AND we're not running locally: localhost/file:// has no
  // reCAPTCHA, so activating there would just break Firestore (403 on the debug
  // token exchange). Local dev therefore runs without App Check, exactly like
  // before — the protection that matters is on the real domain.
  var host = location.hostname;
  var isLocal = location.protocol === 'file:' ||
                host === 'localhost' || host === '127.0.0.1' || host === '';
  if (firebase.appCheck && RECAPTCHA_SITE_KEY && !isLocal){
    // Activate before touching Firestore/Auth. Guarded so an SDK that failed to
    // load never breaks the trade tab.
    try {
      firebase.appCheck().activate(
        RECAPTCHA_SITE_KEY, /* isTokenAutoRefreshEnabled = */ true
      );
    } catch (e){ /* App Check optional — ignore activation errors */ }
  }

  var auth = firebase.auth();
  window.__FB__ = {
    db: firebase.firestore(),
    auth: auth,
    // resolves with the anonymous uid once signed in
    ready: auth.signInAnonymously().then(function(cred){ return cred.user.uid; })
  };
})();
