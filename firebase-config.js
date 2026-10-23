// Настройки Firebase.
// Если заменить объект на null, приложение будет работать в демо-режиме (данные только на устройстве).
//
// Где взять: Firebase Console → ⚙ Project settings → General → Your apps → SDK setup and configuration → Config.
// Скопируйте объект целиком вместо null. Эти ключи не секретные: доступ к данным защищают правила Firestore.

self.FIREBASE_CONFIG = {
  apiKey: "AIzaSyDpx8Rvhwk6CqAeitulrRB0MaDzYh_0gn4",
  authDomain: "worship-team-3c86e.firebaseapp.com",
  projectId: "worship-team-3c86e",
  storageBucket: "worship-team-3c86e.firebasestorage.app",
  messagingSenderId: "966748348492",
  appId: "1:966748348492:web:39aa98d54c9f10333354e9",
  measurementId: "G-D88WLBH9W4"
};
/* Пример:
self.FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "worship-team.firebaseapp.com",
  projectId: "worship-team",
  storageBucket: "worship-team.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};
*/

// Ключ для push-уведомлений: Project settings → Cloud Messaging → Web Push certificates → Key pair.
self.FIREBASE_VAPID_KEY = 'BGhk3hNJPnD3tIR5Ca6lhIeIyVQsbRUVkVb-nvUwLccKqdFWXrMj5ASWC4SPgGPOM36kzGGvyd0El4NJcAue4cU';
