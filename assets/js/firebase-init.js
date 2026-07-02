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
  if (typeof firebase === 'undefined' || !firebase.initializeApp){
    window.__FB__ = null; // CDN blocked / offline — trade tab shows a fallback message
    return;
  }
  firebase.initializeApp(config);
  var auth = firebase.auth();
  window.__FB__ = {
    db: firebase.firestore(),
    auth: auth,
    // resolves with the anonymous uid once signed in
    ready: auth.signInAnonymously().then(function(cred){ return cred.user.uid; })
  };
})();
